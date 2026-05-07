import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function AuditoriaScreen() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // Estados para o filtro de mês escolhido
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());

  useEffect(() => {
    carregarAuditoria();
  }, [mes, ano]); // Recarrega sempre que mudar o mês ou ano

  const carregarAuditoria = async () => {
    setCarregando(true);
    
    // Calcula o primeiro e último dia do mês selecionado
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('diarios_campo')
      .select('*')
      .not('foto_url', 'is', null)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('colaborador', { ascending: true }) // Ordena por nome para facilitar o agrupamento
      .order('data', { ascending: true });

    if (data) setLancamentos(data);
    setCarregando(false);
  };

  const gerarPDF = async () => {
    if (lancamentos.length === 0) {
      return Alert.alert("Aviso", "Nenhum registro encontrado neste mês.");
    }
    setGerandoPDF(true);

    try {
      // 1. Agrupa os lançamentos por funcionário na memória
      const agrupadoPorFuncionario = lancamentos.reduce((acc: any, item: any) => {
        if (!acc[item.colaborador]) acc[item.colaborador] = [];
        acc[item.colaborador].push(item);
        return acc;
      }, {});

      // 2. Monta o HTML com quebras de página automáticas
      let htmlPaginas = '';
      
      Object.keys(agrupadoPorFuncionario).forEach((nomeFuncionario) => {
        const registros = agrupadoPorFuncionario[nomeFuncionario];
        
        htmlPaginas += `
          <div class="pagina-funcionario">
            <div class="header-funcionario">
              <h2>Extrato de Auditoria: ${nomeFuncionario}</h2>
              <p>Referente a: ${mes < 10 ? '0' + mes : mes}/${ano} | Total de Dias: ${registros.length}</p>
            </div>
            
            <div class="grid">
              ${registros.map((reg: any) => `
                <div class="card-foto">
                  <img src="${reg.foto_url}" class="img-selfie" />
                  <div class="info-selfie">
                    <strong>${new Date(reg.data).toLocaleDateString('pt-BR')}</strong><br>
                    <span>⏱️ ${new Date(reg.data).toLocaleTimeString('pt-BR').substring(0, 5)}</span><br>
                    <span style="font-size: 8px;">Fz: ${reg.fazenda} | R: ${reg.ramal}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      const htmlCompleto = `
        <html>
          <head>
            <style>
              @page { size: A4; margin: 10mm; }
              body { font-family: sans-serif; color: #333; margin: 0; }
              .pagina-funcionario { page-break-after: always; border-top: 8px solid #27AE60; padding-top: 10px; }
              .header-funcionario { border-bottom: 2px solid #EEE; margin-bottom: 20px; padding-bottom: 10px; }
              h2 { color: #2C3E50; margin: 0; }
              .grid { display: flex; flex-wrap: wrap; gap: 10px; }
              .card-foto { width: 120px; border: 1px solid #DDD; border-radius: 5px; padding: 5px; text-align: center; background: #FAFAFA; }
              .img-selfie { width: 100%; height: 110px; object-fit: cover; border-radius: 3px; }
              .info-selfie { margin-top: 5px; font-size: 9px; line-height: 1.2; }
              .info-selfie strong { color: #E74C3C; }
            </style>
          </head>
          <body>
            ${htmlPaginas}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlCompleto });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (e) {
      Alert.alert("Erro", "Falha ao gerar extrato mensal.");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatório Mensal 📑</Text>
        <Text style={styles.subtitle}>Auditoria Individual por Página</Text>
      </View>

      {/* FILTROS DE DATA */}
      <View style={styles.filtrosBox}>
        <View style={styles.filtroItem}>
          <Text style={styles.labelFiltro}>Mês:</Text>
          <Picker selectedValue={mes} onValueChange={(v) => setMes(v)} style={styles.picker}>
            {Array.from({length: 12}, (_, i) => (
              <Picker.Item key={i+1} label={new Date(0, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()} value={i+1} />
            ))}
          </Picker>
        </View>
        <View style={styles.filtroItem}>
          <Text style={styles.labelFiltro}>Ano:</Text>
          <Picker selectedValue={ano} onValueChange={(v) => setAno(v)} style={styles.picker}>
            <Picker.Item label="2025" value={2025} />
            <Picker.Item label="2026" value={2026} />
          </Picker>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.btnGerar, gerandoPDF && { backgroundColor: '#95A5A6' }]} 
        onPress={gerarPDF}
        disabled={gerandoPDF}
      >
        {gerandoPDF ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnGerarTexto}>📄 GERAR EXTRATO MENSAL</Text>}
      </TouchableOpacity>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          <Text style={styles.contador}>Encontrados {lancamentos.length} registros com foto.</Text>
          {/* Mostra um resumo rápido na tela */}
          {lancamentos.slice(0, 10).map((item, idx) => (
            <View key={idx} style={styles.resumoRow}>
              <Text style={styles.resumoNome}>👤 {item.colaborador}</Text>
              <Text style={styles.resumoData}>{new Date(item.data).toLocaleDateString('pt-BR')}</Text>
            </View>
          ))}
          {lancamentos.length > 10 && <Text style={styles.mais}>... e mais {lancamentos.length - 10} fotos.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { marginTop: 50, marginBottom: 10, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 13, color: '#7F8C8D' },
  
  filtrosBox: { flexDirection: 'row', padding: 15, gap: 10 },
  filtroItem: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#DDD', paddingLeft: 10 },
  labelFiltro: { fontSize: 10, fontWeight: 'bold', color: '#95A5A6', marginTop: 5 },
  picker: { height: 45, width: '100%' },

  btnGerar: { backgroundColor: '#27AE60', margin: 15, padding: 15, borderRadius: 10, alignItems: 'center', elevation: 3 },
  btnGerarTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  lista: { padding: 15 },
  contador: { textAlign: 'center', color: '#7F8C8D', marginBottom: 15, fontSize: 12 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  resumoNome: { fontSize: 14, color: '#34495E', fontWeight: 'bold' },
  resumoData: { fontSize: 14, color: '#95A5A6' },
  mais: { textAlign: 'center', marginTop: 10, fontStyle: 'italic', color: '#BDC3C7' }
});