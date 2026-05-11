import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function AuditoriaScreen() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // FILTROS DE DATA INICIAL
  const [diaInic, setDiaInic] = useState(1);
  const [mesInic, setMesInic] = useState(new Date().getMonth() + 1);
  const [anoInic, setAnoInic] = useState(new Date().getFullYear());

  // FILTROS DE DATA FINAL
  const [diaFim, setDiaFim] = useState(new Date().getDate());
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());

  // FILTRO DE COLABORADOR
  const [colaboradorSel, setColaboradorSel] = useState('Todos');
  const [listaColaboradores, setListaColaboradores] = useState<string[]>([]);

  useEffect(() => {
    puxarNomesColaboradores();
  }, []);

  useEffect(() => {
    carregarAuditoria();
  }, [diaInic, mesInic, anoInic, diaFim, mesFim, anoFim, colaboradorSel]);

  const puxarNomesColaboradores = async () => {
    const { data } = await supabase.from('diarios_campo').select('colaborador');
    if (data) {
      const nomesUnicos = Array.from(new Set(data.map(i => i.colaborador)));
      setListaColaboradores(nomesUnicos.sort());
    }
  };

  const carregarAuditoria = async () => {
    setCarregando(true);
    
    // 🛡️ TRAVA DE SEGURANÇA: Criamos as datas em UTC puro para evitar erro de fuso horário
    // A foto do dia 08/05 só aparecerá se estiver dentro do intervalo exato selecionado.
    const stringInic = new Date(Date.UTC(anoInic, mesInic - 1, diaInic, 0, 0, 0)).toISOString();
    const stringFim = new Date(Date.UTC(anoFim, mesFim - 1, diaFim, 23, 59, 59)).toISOString();

    let query = supabase
      .from('diarios_campo')
      .select('*')
      .not('foto_url', 'is', null)
      .gte('data', stringInic)
      .lte('data', stringFim);

    if (colaboradorSel !== 'Todos') {
      query = query.eq('colaborador', colaboradorSel);
    }

    const { data, error } = await query.order('data', { ascending: false });

    if (data) setLancamentos(data);
    setCarregando(false);
  };

  const gerarPDF = async () => {
    if (lancamentos.length === 0) return Alert.alert("Aviso", "Nenhum registro no período.");
    setGerandoPDF(true);

    try {
      const agrupado = lancamentos.reduce((acc: any, item: any) => {
        if (!acc[item.colaborador]) acc[item.colaborador] = [];
        acc[item.colaborador].push(item);
        return acc;
      }, {});

      let htmlPaginas = '';
      Object.keys(agrupado).forEach((nome) => {
        const regs = agrupado[nome];
        htmlPaginas += `
          <div class="pagina">
            <div class="header">
              <h2>Auditoria: ${nome}</h2>
              <p>Período: ${diaInic}/${mesInic}/${anoInic} até ${diaFim}/${mesFim}/${anoFim}</p>
            </div>
            <div class="grid">
              ${regs.map((r: any) => `
                <div class="card">
                  <img src="${r.foto_url}" />
                  <div class="txt">
                    <strong>${new Date(r.data).toLocaleDateString('pt-BR')}</strong> - ${new Date(r.data).toLocaleTimeString('pt-BR').substring(0, 5)}<br>
                    <span>Fiscal: ${r.fiscal_nome || 'Admin'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      const htmlCompleto = `<html><head><style>
        @page { size: A4; margin: 10mm; }
        body { font-family: sans-serif; color: #333; }
        .pagina { page-break-after: always; border-top: 5px solid #27AE60; padding-top: 10px; }
        .header { margin-bottom: 15px; border-bottom: 1px solid #EEE; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .card { width: 105px; border: 1px solid #DDD; text-align: center; font-size: 8px; padding: 3px; background: #F9F9F9; }
        img { width: 100%; height: 90px; object-fit: cover; border-radius: 2px; }
      </style></head><body>${htmlPaginas}</body></html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlCompleto });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("Erro", "Falha ao gerar o relatório.");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Auditoria por Período 📸</Text>
        <Text style={styles.subtitle}>Pesquisa entre datas e funcionários</Text>
      </View>

      {/* FILTROS DE DATA - DE / ATÉ */}
      <View style={styles.filtrosContainer}>
        <Text style={styles.secaoTitle}>📅 De:</Text>
        <View style={styles.row}>
          <View style={styles.boxPicker}><Picker selectedValue={diaInic} onValueChange={setDiaInic} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={mesInic} onValueChange={setMesInic} style={styles.picker}>{Array.from({length: 12}, (_, i) => <Picker.Item key={i} label={new Date(0, i).toLocaleString('pt-BR', {month: 'short'}).toUpperCase()} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={anoInic} onValueChange={setAnoInic} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
        </View>

        <Text style={styles.secaoTitle}>📅 Até:</Text>
        <View style={styles.row}>
          <View style={styles.boxPicker}><Picker selectedValue={diaFim} onValueChange={setDiaFim} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={mesFim} onValueChange={setMesFim} style={styles.picker}>{Array.from({length: 12}, (_, i) => <Picker.Item key={i} label={new Date(0, i).toLocaleString('pt-BR', {month: 'short'}).toUpperCase()} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={anoFim} onValueChange={setAnoFim} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
        </View>
      </View>

      <View style={styles.filtroFunc}>
         <Text style={styles.labelFunc}>👤 Colaborador</Text>
         <Picker selectedValue={colaboradorSel} onValueChange={setColaboradorSel} style={styles.picker}>
            <Picker.Item label="TODOS OS FUNCIONÁRIOS" value="Todos" />
            {listaColaboradores.map((n, i) => <Picker.Item key={i} label={n} value={n} />)}
         </Picker>
      </View>

      <TouchableOpacity style={styles.btnPdf} onPress={gerarPDF} disabled={gerandoPDF}>
        {gerandoPDF ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPdfTxt}>📄 GERAR PDF DO PERÍODO</Text>}
      </TouchableOpacity>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 30}} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.count}>{lancamentos.length} fotos no período</Text>
          <View style={styles.grid}>
            {lancamentos.map((item, idx) => (
              <View key={idx} style={styles.card}>
                <Image source={{ uri: item.foto_url }} style={styles.foto} />
                <View style={styles.info}>
                  <Text style={styles.nome} numberOfLines={1}>{item.colaborador}</Text>
                  <Text style={styles.fiscal}>👮 {item.fiscal_nome || 'Admin'}</Text>
                  <Text style={styles.data}>{new Date(item.data).toLocaleDateString('pt-BR')} {new Date(item.data).toLocaleTimeString('pt-BR').substring(0, 5)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { marginTop: 45, marginBottom: 10, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 12, color: '#7F8C8D' },
  
  filtrosContainer: { paddingHorizontal: 15 },
  secaoTitle: { fontSize: 11, fontWeight: 'bold', color: '#34495E', marginBottom: 5, marginTop: 5 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  boxPicker: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, height: 45, borderWidth: 1, borderColor: '#DCDFE6', justifyContent: 'center' },
  picker: { width: '100%' },

  filtroFunc: { backgroundColor: '#FFF', marginHorizontal: 15, marginVertical: 10, borderRadius: 8, height: 55, borderWidth: 1, borderColor: '#DCDFE6', justifyContent: 'center' },
  labelFunc: { fontSize: 10, fontWeight: 'bold', color: '#909399', marginLeft: 10 },

  btnPdf: { backgroundColor: '#2C3E50', marginHorizontal: 15, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnPdfTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  scroll: { paddingHorizontal: 10, paddingBottom: 40 },
  count: { textAlign: 'center', marginBottom: 10, fontSize: 12, color: '#606266', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#FFF', borderRadius: 10, marginBottom: 15, elevation: 2, overflow: 'hidden' },
  foto: { width: '100%', height: 110 },
  info: { padding: 8 },
  nome: { fontSize: 12, fontWeight: 'bold', color: '#2C3E50' },
  fiscal: { fontSize: 10, color: '#E74C3C', fontWeight: 'bold', marginTop: 2 },
  data: { fontSize: 9, color: '#909399', marginTop: 4 }
});