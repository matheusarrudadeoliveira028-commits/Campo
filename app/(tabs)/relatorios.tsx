import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function RelatoriosScreen() {
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('');
  const [encarregado, setEncarregado] = useState('Mario Rodrigues Valentin');
  
  // DATAS
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [gerando, setGerando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarColaboradores();
    
    // Sugere o mês atual preenchido automaticamente (ex: 01/04/2026 e 30/04/2026)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setDataInicio(primeiroDia.toLocaleDateString('pt-BR'));
    setDataFim(ultimoDia.toLocaleDateString('pt-BR'));
  }, []);

  const carregarColaboradores = async () => {
    setCarregando(true);
    const { data } = await supabase.from('colaboradores').select('*').order('nome');
    if (data) setListaColaboradores(data);
    setCarregando(false);
  };

  // Função para converter "DD/MM/YYYY" para "YYYY-MM-DD" que o banco de dados entende
  const converterDataParaBanco = (dataBR: string) => {
    const partes = dataBR.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return null;
  };

  const gerarPDF = async () => {
    if (!colaboradorSelecionado) return Alert.alert('Aviso', 'Selecione um colaborador (ou Todos)!');
    if (!dataInicio || !dataFim) return Alert.alert('Aviso', 'Preencha a data inicial e final!');

    const dtInicioBD = converterDataParaBanco(dataInicio);
    const dtFimBD = converterDataParaBanco(dataFim);

    if (!dtInicioBD || !dtFimBD) return Alert.alert('Erro', 'Use o formato DD/MM/AAAA para as datas.');

    setGerando(true);

    try {
      // 1. Busca todos os lançamentos
      let query = supabase.from('diarios_campo').select('*')
        .gte('data', `${dtInicioBD} 00:00:00`)
        .lte('data', `${dtFimBD} 23:59:59`)
        .order('data', { ascending: true });

      if (colaboradorSelecionado !== 'TODOS') {
        query = query.eq('colaborador', colaboradorSelecionado);
      }

      const { data: lancamentos, error: errLanc } = await query;
      if (errLanc) throw errLanc;

      if (!lancamentos || lancamentos.length === 0) {
        setGerando(false);
        return Alert.alert('Aviso', 'Nenhum lançamento encontrado neste período.');
      }

      // 2. Busca o histórico de férias (MÁGICA NOVA AQUI)
      const { data: feriasDB } = await supabase.from('ferias').select('*');

      const estaDeFerias = (nome: string, dataLancamento: string) => {
        const dataFormatada = dataLancamento.split('T')[0];
        return feriasDB?.some(f => 
          f.colaborador_nome === nome && 
          dataFormatada >= f.data_inicio && 
          dataFormatada <= f.data_fim
        );
      };

      // 3. AGRUPAMENTO DUPLO (Por Colaborador E Por Tipo - Registrado/Diária)
      const agrupado = lancamentos.reduce((acc: any, item: any) => {
        const tipoFolha = estaDeFerias(item.colaborador, item.data) ? 'Diaria' : 'Registrado';
        const chaveAgrupamento = `${item.colaborador}_${tipoFolha}`;

        if (!acc[chaveAgrupamento]) {
          acc[chaveAgrupamento] = {
            nome: item.colaborador,
            tipo: tipoFolha,
            registros: []
          };
        }
        acc[chaveAgrupamento].registros.push(item);
        return acc;
      }, {});

      // 4. Gera as páginas HTML
      const chavesFolhas = Object.keys(agrupado);
      let paginasHTML = '';

      chavesFolhas.forEach((chave, index) => {
        const folha = agrupado[chave];
        const totalGeral = folha.registros.reduce((soma: number, item: any) => soma + (item.valor_total || 0), 0);

        let linhasTabela = '';
        folha.registros.forEach((item: any) => {
          const dataObj = new Date(item.data);
          const dia = dataObj.getDate().toString().padStart(2, '0');
          const valorUni = item.valor_unitario ? item.valor_unitario.toFixed(4).replace('.', ',') : '0,00';
          const valorTot = item.valor_total ? item.valor_total.toFixed(2).replace('.', ',') : '0,00';

          linhasTabela += `
            <tr>
              <td>${dia}</td>
              <td>${item.servico}</td>
              <td>${item.fazenda}</td>
              <td>${item.quadra}</td>
              <td>${item.ramal}</td>
              <td>${item.quantidade}</td>
              <td>${valorUni}</td>
              <td>R$ ${valorTot}</td>
            </tr>
          `;
        });

        // HTML de UMA PÁGINA
        const pagina = `
          <div class="page-container">
            <div class="header-container">
              <div class="header-left">
                <p>Período: <strong>${dataInicio} até ${dataFim}</strong></p>
                <p>Encarregado: <strong>${encarregado}</strong></p>
                <p>Produção: <strong style="${folha.tipo === 'Diaria' ? 'color: #E74C3C; text-transform: uppercase;' : ''}">${folha.tipo}</strong></p>
                <p>Colaborador: <strong style="font-size: 16px; text-transform: uppercase;">${folha.nome}</strong></p>
              </div>
              <div class="header-right">
                <p><strong>Luiz Felipe Areovaldo Calhim Manoel Abud</strong></p>
                <p>Fazenda Acauã s/n Bairro Pirambóia</p>
                <p>Anhembi SP Cep 18.620-000</p>
                <p>Tel: (14) 3361-7492/3361-9274 Escritório</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">Dia</th>
                  <th style="width: 25%;">Serviço</th>
                  <th style="width: 15%;">Fazenda</th>
                  <th style="width: 10%;">Quadra</th>
                  <th style="width: 10%;">Ramal</th>
                  <th style="width: 12%;">Qtd</th>
                  <th style="width: 10%;">Valor</th>
                  <th style="width: 10%;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${linhasTabela}
              </tbody>
            </table>

            <div class="footer-container">
              <div>
                <p style="margin-top: 40px; font-size: 12px; font-style: italic;">declaro ter recebido os valores acima</p>
              </div>
              <div class="footer-totals">
                <p>Total: <strong>R$ ${totalGeral.toFixed(2).replace('.', ',')}</strong></p>
                <p>Vale: <strong>R$ _________</strong></p>
                <p style="font-size: 18px;">A receber: <strong>R$ ${totalGeral.toFixed(2).replace('.', ',')}</strong></p>
              </div>
            </div>

            <div class="signature-area">
              <hr style="width: 300px; border: 1px solid #000;">
              <p style="font-size: 14px; font-weight: bold;">Assinatura do Colaborador</p>
            </div>
          </div>
          ${index < chavesFolhas.length - 1 ? '<div class="quebra-pagina"></div>' : ''}
        `;

        paginasHTML += pagina;
      });

      const htmlCompleto = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              @page { margin: 15mm; size: A4; }
              body { font-family: 'Arial', sans-serif; font-size: 13px; color: #000; background-color: #FFF; margin: 0; padding: 0; }
              .quebra-pagina { page-break-after: always; }
              .header-container { display: flex; justify-content: space-between; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 15px; }
              .header-left p, .header-right p { margin: 4px 0; font-size: 14px; }
              .header-right { text-align: right; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #000; padding: 8px 4px; text-align: center; font-size: 12px; }
              th { background-color: #E8E8E8; font-weight: bold; text-transform: uppercase; }
              tr:nth-child(even) { background-color: #F9F9F9; }
              .footer-container { display: flex; justify-content: space-between; margin-top: 30px; }
              .footer-totals p { margin: 6px 0; font-size: 14px; }
              .signature-area { margin-top: 80px; text-align: center; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            ${paginasHTML}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlCompleto });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (err: any) {
      Alert.alert('Erro', 'Ocorreu um problema ao gerar o PDF: ' + err.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Folha de Produção 📄</Text>
        <Text style={styles.subtitle}>Gerar extratos por período</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nome do Encarregado:</Text>
        <TextInput style={styles.input} value={encarregado} onChangeText={setEncarregado} />

        {/* CAMPO DE DATAS */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Data Inicial:</Text>
            <TextInput style={styles.input} value={dataInicio} onChangeText={setDataInicio} placeholder="DD/MM/AAAA" keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Data Final:</Text>
            <TextInput style={styles.input} value={dataFim} onChangeText={setDataFim} placeholder="DD/MM/AAAA" keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Selecione o Colaborador:</Text>
        {carregando ? (
          <ActivityIndicator color="#2980B9" />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker selectedValue={colaboradorSelecionado} onValueChange={setColaboradorSelecionado} style={styles.picker}>
              <Picker.Item label="Escolha..." value="" />
              <Picker.Item label="👉 TODOS OS FUNCIONÁRIOS" value="TODOS" />
              {listaColaboradores.map((item) => (
                <Picker.Item key={item.id} label={item.nome} value={item.nome} />
              ))}
            </Picker>
          </View>
        )}

        <TouchableOpacity style={[styles.button, gerando || !colaboradorSelecionado ? styles.buttonDisabled : null]} onPress={gerarPDF} disabled={gerando || !colaboradorSelecionado}>
          {gerando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Gerar Relatório em PDF</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 30, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 10, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8FAFC', color: '#2C3E50', marginBottom: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden', marginBottom: 25 },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  button: { backgroundColor: '#2980B9', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#AED6F1' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
});