import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function EstatisticasScreen() {
  const [carregando, setCarregando] = useState(true);

  // FILTROS DE DATA
  const [diaInic, setDiaInic] = useState(1);
  const [mesInic, setMesInic] = useState(new Date().getMonth() + 1);
  const [anoInic, setAnoInic] = useState(new Date().getFullYear());

  const [diaFim, setDiaFim] = useState(new Date().getDate());
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());

  // ESTADOS PARA OS DADOS PROCESSADOS
  const [totalTambores, setTotalTambores] = useState(0);
  const [totalEstrias, setTotalEstrias] = useState(0);
  const [producaoPorLocal, setProducaoPorLocal] = useState<any[]>([]);
  const [intervalosRetorno, setIntervalosRetorno] = useState<any[]>([]);

  useEffect(() => {
    carregarEstatisticas();
  }, [diaInic, mesInic, anoInic, diaFim, mesFim, anoFim]);

  const carregarEstatisticas = async () => {
    setCarregando(true);

    const stringInic = new Date(Date.UTC(anoInic, mesInic - 1, diaInic, 0, 0, 0)).toISOString();
    const stringFim = new Date(Date.UTC(anoFim, mesFim - 1, diaFim, 23, 59, 59)).toISOString();

    // 👇 BUSCANDO EXATAMENTE AS COLUNAS QUE EXISTEM NA SUA TABELA
    const { data, error } = await supabase
      .from('diarios_campo')
      .select('data, servico, quantidade, fazenda, quadra, ramal')
      .gte('data', stringInic)
      .lte('data', stringFim)
      .order('data', { ascending: true }); // Ordenado para calcular dias corretamente

    if (error) {
      Alert.alert("🚨 Erro no Supabase", error.message);
      setCarregando(false);
      return;
    }

    if (data) {
      processarDados(data);
    } else {
      setCarregando(false);
    }
  };

  const processarDados = (dados: any[]) => {
    let tTambores = 0;
    let tEstrias = 0;
    const agrupamentoLocal: any = {};
    const datasPorRamal: any = {};

    dados.forEach((item) => {
      // 1. IDENTIFICA SE É ESTRIA OU TAMBOR BASEADO NA COLUNA 'SERVICO'
      const nomeServico = (item.servico || '').toLowerCase();
      let qtdTambores = 0;
      let qtdEstrias = 0;

      if (nomeServico.includes('estria')) {
        qtdEstrias = Number(item.quantidade) || 0;
      } else {
        // Se não for estria, consideramos como coleta de tambor
        qtdTambores = Number(item.quantidade) || 0;
      }
      
      tTambores += qtdTambores;
      tEstrias += qtdEstrias;

      // 2. AGRUPAMENTO POR FAZENDA > QUADRA > RAMAL
      const chaveLocal = `${item.fazenda || 'N/A'} - Quadra ${item.quadra || 'N/A'} - Ramal ${item.ramal || 'N/A'}`;
      if (!agrupamentoLocal[chaveLocal]) {
        agrupamentoLocal[chaveLocal] = { tambores: 0, estrias: 0 };
      }
      agrupamentoLocal[chaveLocal].tambores += qtdTambores;
      agrupamentoLocal[chaveLocal].estrias += qtdEstrias;

      // 3. SEPARANDO DATAS APENAS DE "ESTRIAS" PARA CALCULAR O INTERVALO DE SANGRA
      if (nomeServico.includes('estria')) {
        const ramal = item.ramal || 'Desconhecido';
        if (!datasPorRamal[ramal]) {
          datasPorRamal[ramal] = [];
        }
        datasPorRamal[ramal].push(new Date(item.data));
      }
    });

    // 4. CALCULANDO INTERVALO DE DIAS (Última vez vs Penúltima vez na Estria)
    const arrayIntervalos: any[] = [];
    Object.keys(datasPorRamal).forEach(ramal => {
      const datas = datasPorRamal[ramal];
      if (datas.length > 1) {
        const ultimaData = datas[datas.length - 1];
        const penultimaData = datas[datas.length - 2];
        
        const diffTempo = Math.abs(ultimaData.getTime() - penultimaData.getTime());
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
        
        arrayIntervalos.push({ 
          ramal, 
          dias: diffDias, 
          ultima: ultimaData.toLocaleDateString('pt-BR') 
        });
      } else if (datas.length === 1) {
         arrayIntervalos.push({ 
          ramal, 
          dias: 'Primeiro corte do período', 
          ultima: datas[0].toLocaleDateString('pt-BR') 
        });
      }
    });

    setTotalTambores(tTambores);
    setTotalEstrias(tEstrias);
    
    setProducaoPorLocal(Object.keys(agrupamentoLocal).map(chave => ({
      local: chave,
      ...agrupamentoLocal[chave]
    })));

    setIntervalosRetorno(arrayIntervalos);
    setCarregando(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard de Produção 📊</Text>
        <Text style={styles.subtitle}>Análise de Extração e Intervalos</Text>
      </View>

      <View style={styles.filtrosContainer}>
        <View style={styles.row}>
          <View style={styles.boxPicker}><Picker selectedValue={diaInic} onValueChange={setDiaInic} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={mesInic} onValueChange={setMesInic} style={styles.picker}>{Array.from({length: 12}, (_, i) => <Picker.Item key={i} label={new Date(0, i).toLocaleString('pt-BR', {month: 'short'}).toUpperCase()} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={anoInic} onValueChange={setAnoInic} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
        </View>
        <Text style={styles.secaoTitle}>Até:</Text>
        <View style={styles.row}>
          <View style={styles.boxPicker}><Picker selectedValue={diaFim} onValueChange={setDiaFim} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={mesFim} onValueChange={setMesFim} style={styles.picker}>{Array.from({length: 12}, (_, i) => <Picker.Item key={i} label={new Date(0, i).toLocaleString('pt-BR', {month: 'short'}).toUpperCase()} value={i+1} />)}</Picker></View>
          <View style={styles.boxPicker}><Picker selectedValue={anoFim} onValueChange={setAnoFim} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 50}} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <View style={styles.cardsRow}>
            <View style={[styles.cardTotal, { borderLeftColor: '#F39C12' }]}>
              <Text style={styles.cardTitulo}>Total Tambores</Text>
              <Text style={styles.cardValor}>{totalTambores}</Text>
            </View>
            <View style={[styles.cardTotal, { borderLeftColor: '#8E44AD' }]}>
              <Text style={styles.cardTitulo}>Total Estrias</Text>
              <Text style={styles.cardValor}>{totalEstrias}</Text>
            </View>
          </View>

          <Text style={styles.tituloSecao}>📍 Produção por Setor</Text>
          {producaoPorLocal.length === 0 ? <Text style={styles.vazio}>Nenhum registro no período.</Text> : null}
          {producaoPorLocal.map((item, index) => (
            <View key={index} style={styles.cardLista}>
              <Text style={styles.localTexto}>{item.local}</Text>
              <View style={styles.badgesRow}>
                <View style={styles.badgeTambor}><Text style={styles.badgeTexto}>🛢️ {item.tambores} Tambores</Text></View>
                <View style={styles.badgeEstria}><Text style={styles.badgeTexto}>🔪 {item.estrias} Estrias</Text></View>
              </View>
            </View>
          ))}

          <Text style={styles.tituloSecao}>⏱️ Intervalo de Retorno nos Ramais</Text>
          {intervalosRetorno.length === 0 ? <Text style={styles.vazio}>Sem estrias no período.</Text> : null}
          {intervalosRetorno.map((item, index) => (
            <View key={index} style={styles.cardIntervalo}>
              <Text style={styles.ramalNome}>Ramal {item.ramal}</Text>
              <View style={styles.intervaloDados}>
                <Text style={styles.diasTexto}>
                  {typeof item.dias === 'number' ? `Voltou após ${item.dias} dias` : item.dias}
                </Text>
                <Text style={styles.ultimaData}>Última vez: {item.ultima}</Text>
              </View>
            </View>
          ))}

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
  
  filtrosContainer: { paddingHorizontal: 15, marginBottom: 10 },
  secaoTitle: { fontSize: 11, fontWeight: 'bold', color: '#34495E', marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  boxPicker: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, height: 40, borderWidth: 1, borderColor: '#DCDFE6', justifyContent: 'center' },
  picker: { width: '100%' },

  scroll: { paddingHorizontal: 15, paddingBottom: 40 },
  
  cardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  cardTotal: { backgroundColor: '#FFF', width: '48%', padding: 15, borderRadius: 10, borderLeftWidth: 5, elevation: 2 },
  cardTitulo: { fontSize: 12, color: '#7F8C8D', fontWeight: 'bold' },
  cardValor: { fontSize: 24, color: '#2C3E50', fontWeight: 'bold', marginTop: 5 },

  tituloSecao: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50', marginBottom: 10, marginTop: 10 },
  vazio: { textAlign: 'center', color: '#95A5A6', fontStyle: 'italic' },
  
  cardLista: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
  localTexto: { fontSize: 14, fontWeight: 'bold', color: '#34495E', marginBottom: 10 },
  badgesRow: { flexDirection: 'row', gap: 10 },
  badgeTambor: { backgroundColor: '#F39C12', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5 },
  badgeEstria: { backgroundColor: '#8E44AD', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5 },
  badgeTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  cardIntervalo: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: '#3498DB', elevation: 1 },
  ramalNome: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50' },
  intervaloDados: { alignItems: 'flex-end' },
  diasTexto: { fontSize: 13, fontWeight: 'bold', color: '#E74C3C' },
  ultimaData: { fontSize: 10, color: '#95A5A6', marginTop: 2 }
});