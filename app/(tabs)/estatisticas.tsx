import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function EstatisticasScreen() {
  const [carregando, setCarregando] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  // FILTROS DE DATA
  const [diaInic, setDiaInic] = useState(1);
  const [mesInic, setMesInic] = useState(new Date().getMonth() + 1);
  const [anoInic, setAnoInic] = useState(new Date().getFullYear());

  const [diaFim, setDiaFim] = useState(new Date().getDate());
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());

  // FILTROS AVANÇADOS
  const [filtroFazenda, setFiltroFazenda] = useState('');
  const [filtroQuadra, setFiltroQuadra] = useState('');
  const [filtroRamal, setFiltroRamal] = useState('');
  const [filtroServico, setFiltroServico] = useState('');

  // LISTAS DE APOIO PARA OS FILTROS
  const [mapaCompleto, setMapaCompleto] = useState<any[]>([]);
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<string[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<string[]>([]);
  const [ramaisDisponiveis, setRamaisDisponiveis] = useState<string[]>([]);

  // ESTADOS PARA OS DADOS PROCESSADOS
  const [totalTambores, setTotalTambores] = useState(0);
  const [totalEstrias, setTotalEstrias] = useState(0);
  const [producaoPorLocal, setProducaoPorLocal] = useState<any[]>([]);
  const [intervalosRetorno, setIntervalosRetorno] = useState<any[]>([]);

  // Carrega as Fazendas e Serviços ao abrir a tela
  useEffect(() => {
    buscarDadosDeApoio();
  }, []);

  const buscarDadosDeApoio = async () => {
    const { data: mapa } = await supabase.from('mapa_fazendas').select('*');
    if (mapa) {
      setMapaCompleto(mapa);
      setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
    }
    const { data: servs } = await supabase.from('servicos').select('*').order('nome');
    if (servs) setListaServicos(servs);
    
    // Já faz a primeira busca padrão do mês
    carregarEstatisticas();
  };

  // Efeito em Cascata: Limpa a Quadra e Ramal se mudar a Fazenda
  useEffect(() => {
    setFiltroQuadra('');
    setFiltroRamal('');
    if (filtroFazenda) {
      const quadras = [...new Set(mapaCompleto.filter(m => m.fazenda === filtroFazenda).map(m => m.quadra))] as string[];
      setQuadrasDisponiveis(quadras);
    } else {
      setQuadrasDisponiveis([]);
    }
  }, [filtroFazenda, mapaCompleto]);

  // Efeito em Cascata: Limpa o Ramal se mudar a Quadra
  useEffect(() => {
    setFiltroRamal('');
    if (filtroQuadra) {
      const ramais = [...new Set(mapaCompleto.filter(m => m.fazenda === filtroFazenda && m.quadra === filtroQuadra).map(m => m.ramal))] as string[];
      setRamaisDisponiveis(ramais);
    } else {
      setRamaisDisponiveis([]);
    }
  }, [filtroQuadra, filtroFazenda, mapaCompleto]);

  const handleChangeMesInic = (mes: number) => {
    setMesInic(mes);
    setMesFim(mes); 
    const ultimoDia = new Date(anoInic, mes, 0).getDate();
    setDiaFim(ultimoDia);
  };

  const handleChangeAnoInic = (ano: number) => {
    setAnoInic(ano);
    setAnoFim(ano); 
    const ultimoDia = new Date(ano, mesInic, 0).getDate();
    setDiaFim(ultimoDia);
  };

  const carregarEstatisticas = async () => {
    setCarregando(true);

    const pad = (n: number) => n.toString().padStart(2, '0');

    const ultimoDiaMesInic = new Date(anoInic, mesInic, 0).getDate();
    const diaInicReal = diaInic > ultimoDiaMesInic ? ultimoDiaMesInic : diaInic;

    const ultimoDiaMesFim = new Date(anoFim, mesFim, 0).getDate();
    const diaFimReal = diaFim > ultimoDiaMesFim ? ultimoDiaMesFim : diaFim;

    const stringInic = `${anoInic}-${pad(mesInic)}-${pad(diaInicReal)}T00:00:00.000-03:00`;
    const stringFim = `${anoFim}-${pad(mesFim)}-${pad(diaFimReal)}T23:59:59.999-03:00`;

    let query = supabase
      .from('diarios_campo')
      .select('data, servico, quantidade, fazenda, quadra, ramal')
      .gte('data', stringInic)
      .lte('data', stringFim)
      .order('data', { ascending: true }); 

    // 👉 APLICA OS FILTROS AVANÇADOS NA BUSCA
    if (filtroFazenda) query = query.eq('fazenda', filtroFazenda);
    if (filtroQuadra) query = query.eq('quadra', filtroQuadra);
    if (filtroRamal) query = query.eq('ramal', filtroRamal);
    if (filtroServico) query = query.eq('servico', filtroServico);

    const { data, error } = await query;

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
      const nomeServico = (item.servico || '').toLowerCase();
      let qtdTambores = 0;
      let qtdEstrias = 0;

      // Se a pessoa selecionou um serviço específico que não tem "estria" no nome, 
      // os números cairão no campo "Tambores" genérico.
      if (nomeServico.includes('estria')) {
        qtdEstrias = Number(item.quantidade) || 0;
      } else {
        qtdTambores = Number(item.quantidade) || 0;
      }
      
      tTambores += qtdTambores;
      tEstrias += qtdEstrias;

      const chaveLocal = `${item.fazenda || 'N/A'} - Quadra ${item.quadra || 'N/A'} - Ramal ${item.ramal || 'N/A'}`;
      if (!agrupamentoLocal[chaveLocal]) {
        agrupamentoLocal[chaveLocal] = { tambores: 0, estrias: 0 };
      }
      agrupamentoLocal[chaveLocal].tambores += qtdTambores;
      agrupamentoLocal[chaveLocal].estrias += qtdEstrias;

      if (nomeServico.includes('estria')) {
        const ramal = item.ramal || 'Desconhecido';
        if (!datasPorRamal[ramal]) {
          datasPorRamal[ramal] = [];
        }
        datasPorRamal[ramal].push(item.data.split('T')[0]);
      }
    });

    const arrayIntervalos: any[] = [];
    Object.keys(datasPorRamal).forEach(ramal => {
      const datas = datasPorRamal[ramal];
      if (datas.length > 1) {
        const ultimaDataStr = datas[datas.length - 1]; 
        const penultimaDataStr = datas[datas.length - 2];
        
        const ultimaDataObj = new Date(ultimaDataStr + "T12:00:00Z");
        const penultimaDataObj = new Date(penultimaDataStr + "T12:00:00Z");
        
        const diffTempo = Math.abs(ultimaDataObj.getTime() - penultimaDataObj.getTime());
        const diffDias = Math.round(diffTempo / (1000 * 60 * 60 * 24));
        
        arrayIntervalos.push({ 
          ramal, 
          dias: diffDias, 
          ultima: ultimaDataStr.split('-').reverse().join('/') 
        });
      } else if (datas.length === 1) {
         arrayIntervalos.push({ 
          ramal, 
          dias: 'Primeiro corte do período', 
          ultima: datas[0].split('-').reverse().join('/') 
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

  const gerarPdfRelatorio = async () => {
    if (producaoPorLocal.length === 0) return Alert.alert("Aviso", "Não há dados para gerar o relatório.");
    setGerandoPDF(true);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const txtFiltroFazenda = filtroFazenda || 'Todas';
    const txtFiltroQuadra = filtroQuadra || 'Todas';
    const txtFiltroRamal = filtroRamal || 'Todos';
    const txtFiltroServico = filtroServico || 'Todos os Serviços';

    let linhasTabelaProducao = '';
    producaoPorLocal.forEach(item => {
      linhasTabelaProducao += `<tr><td>${item.local}</td><td>${item.tambores}</td><td>${item.estrias}</td></tr>`;
    });

    let linhasTabelaIntervalo = '';
    intervalosRetorno.forEach(item => {
      linhasTabelaIntervalo += `<tr><td>Ramal ${item.ramal}</td><td>${item.ultima}</td><td>${item.dias}</td></tr>`;
    });

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; color: #333; }
            h2 { text-align: center; color: #2C3E50; border-bottom: 2px solid #27AE60; padding-bottom: 10px; }
            .filtros { background-color: #F8FAFC; border: 1px solid #BDC3C7; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .filtros p { margin: 5px 0; }
            .cards { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .card { width: 48%; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 18px; }
            .card-tambor { background-color: #FEF5E7; color: #D35400; border: 1px solid #F39C12; }
            .card-estria { background-color: #F4ECF7; color: #8E44AD; border: 1px solid #9B59B6; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
            th, td { border: 1px solid #BDC3C7; padding: 8px; text-align: center; }
            th { background-color: #ECF0F1; color: #2C3E50; }
            h3 { color: #34495E; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <h2>RELATÓRIO DE ESTATÍSTICAS E PRODUÇÃO</h2>
          
          <div class="filtros">
            <p><strong>Período:</strong> ${pad(diaInic)}/${pad(mesInic)}/${anoInic} a ${pad(diaFim)}/${pad(mesFim)}/${anoFim}</p>
            <p><strong>Fazenda:</strong> ${txtFiltroFazenda} | <strong>Quadra:</strong> ${txtFiltroQuadra} | <strong>Ramal:</strong> ${txtFiltroRamal}</p>
            <p><strong>Serviço Computado:</strong> ${txtFiltroServico}</p>
          </div>

          <div class="cards">
            <div class="card card-tambor">TOTAL TAMBORES<br><span style="font-size: 24px;">${totalTambores}</span></div>
            <div class="card card-estria">TOTAL ESTRIAS<br><span style="font-size: 24px;">${totalEstrias}</span></div>
          </div>

          <h3>Produção por Setor</h3>
          <table>
            <tr><th style="text-align: left;">Local (Fazenda - Quadra - Ramal)</th><th style="width: 15%">Tambores / Qtd</th><th style="width: 15%">Estrias</th></tr>
            ${linhasTabelaProducao}
          </table>

          ${intervalosRetorno.length > 0 ? `
            <h3>Intervalo de Retorno de Estrias</h3>
            <table>
              <tr><th>Ramal</th><th>Data da Última Estria</th><th>Dias de Retorno</th></tr>
              ${linhasTabelaIntervalo}
            </table>
          ` : ''}

          <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #95A5A6;">
            Documento gerado automaticamente pelo Sistema Brekaz Produção.
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("Erro", "Falha ao gerar PDF.");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard de Produção 📊</Text>
        <Text style={styles.subtitle}>Análise de Extração e Filtros</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.filtrosContainer}>
          <Text style={styles.secaoTitle}>Período de Análise:</Text>
          <View style={styles.row}>
            <View style={styles.boxPicker}><Picker selectedValue={diaInic} onValueChange={setDiaInic} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
            <View style={styles.boxPicker}>
              <Picker selectedValue={mesInic} onValueChange={handleChangeMesInic} style={styles.picker}>
                {MESES.map((mes, index) => <Picker.Item key={index} label={mes} value={index + 1} />)}
              </Picker>
            </View>
            <View style={styles.boxPicker}><Picker selectedValue={anoInic} onValueChange={handleChangeAnoInic} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
          </View>
          <Text style={[styles.secaoTitle, {marginTop: 5}]}>Até:</Text>
          <View style={styles.row}>
            <View style={styles.boxPicker}><Picker selectedValue={diaFim} onValueChange={setDiaFim} style={styles.picker}>{Array.from({length: 31}, (_, i) => <Picker.Item key={i} label={`${i+1}`} value={i+1} />)}</Picker></View>
            <View style={styles.boxPicker}>
              <Picker selectedValue={mesFim} onValueChange={setMesFim} style={styles.picker}>
                {MESES.map((mes, index) => <Picker.Item key={index} label={mes} value={index + 1} />)}
              </Picker>
            </View>
            <View style={styles.boxPicker}><Picker selectedValue={anoFim} onValueChange={setAnoFim} style={styles.picker}><Picker.Item label="2025" value={2025} /><Picker.Item label="2026" value={2026} /></Picker></View>
          </View>

          <Text style={[styles.secaoTitle, {marginTop: 15, borderTopWidth: 1, borderTopColor: '#ECF0F1', paddingTop: 10}]}>Filtros Avançados:</Text>
          
          <View style={styles.row}>
            <View style={styles.boxPicker}>
              <Picker selectedValue={filtroFazenda} onValueChange={setFiltroFazenda} style={styles.picker}>
                <Picker.Item label="Todas Fazendas" value="" />
                {fazendasDisponiveis.map(f => <Picker.Item key={f} label={f} value={f} />)}
              </Picker>
            </View>
            <View style={[styles.boxPicker, !filtroFazenda && styles.disabled]}>
              <Picker enabled={!!filtroFazenda} selectedValue={filtroQuadra} onValueChange={setFiltroQuadra} style={styles.picker}>
                <Picker.Item label="Todas Quadras" value="" />
                {quadrasDisponiveis.map(q => <Picker.Item key={q} label={`Qd: ${q}`} value={q} />)}
              </Picker>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.boxPicker, !filtroQuadra && styles.disabled]}>
              <Picker enabled={!!filtroQuadra} selectedValue={filtroRamal} onValueChange={setFiltroRamal} style={styles.picker}>
                <Picker.Item label="Todos Ramais" value="" />
                {ramaisDisponiveis.map(r => <Picker.Item key={r} label={`Rm: ${r}`} value={r} />)}
              </Picker>
            </View>
            <View style={styles.boxPicker}>
              <Picker selectedValue={filtroServico} onValueChange={setFiltroServico} style={styles.picker}>
                <Picker.Item label="Todos Serviços" value="" />
                {listaServicos.map(s => <Picker.Item key={s.id} label={s.nome} value={s.nome} />)}
              </Picker>
            </View>
          </View>

          <View style={{flexDirection: 'row', gap: 10, marginTop: 15}}>
            <TouchableOpacity style={styles.btnBuscar} onPress={carregarEstatisticas} disabled={carregando}>
              {carregando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnTextoBranco}>🔍 BUSCAR DADOS</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnPdf} onPress={gerarPdfRelatorio} disabled={gerandoPDF || producaoPorLocal.length === 0}>
              {gerandoPDF ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnTextoBranco}>🖨️ PDF</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scroll}>
          {carregando ? (
            <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 50}} />
          ) : (
            <>
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
              {producaoPorLocal.length === 0 ? <Text style={styles.vazio}>Nenhum registro encontrado no filtro atual.</Text> : null}
              {producaoPorLocal.map((item, index) => (
                <View key={index} style={styles.cardLista}>
                  <Text style={styles.localTexto}>{item.local}</Text>
                  <View style={styles.badgesRow}>
                    <View style={styles.badgeTambor}><Text style={styles.badgeTexto}>🛢️ {item.tambores} Tambores / Qtd</Text></View>
                    <View style={styles.badgeEstria}><Text style={styles.badgeTexto}>🔪 {item.estrias} Estrias</Text></View>
                  </View>
                </View>
              ))}

              <Text style={styles.tituloSecao}>⏱️ Intervalo de Retorno nos Ramais</Text>
              {intervalosRetorno.length === 0 ? <Text style={styles.vazio}>Sem dados de retorno para o filtro atual.</Text> : null}
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
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { marginTop: 45, marginBottom: 10, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 12, color: '#7F8C8D' },
  
  filtrosContainer: { paddingHorizontal: 15, marginBottom: 10, backgroundColor: '#FFF', paddingVertical: 15, borderRadius: 10, marginHorizontal: 10, elevation: 3 },
  secaoTitle: { fontSize: 11, fontWeight: 'bold', color: '#34495E', marginBottom: 5 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  boxPicker: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, height: 45, borderWidth: 1, borderColor: '#DCDFE6', justifyContent: 'center', overflow: 'hidden' },
  picker: { width: '100%', height: 45 },
  disabled: { backgroundColor: '#EAEDED', opacity: 0.6 },

  btnBuscar: { flex: 3, backgroundColor: '#2980B9', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnPdf: { flex: 1, backgroundColor: '#E67E22', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnTextoBranco: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  scroll: { paddingHorizontal: 15, paddingTop: 10 },
  
  cardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  cardTotal: { backgroundColor: '#FFF', width: '48%', padding: 15, borderRadius: 10, borderLeftWidth: 5, elevation: 2 },
  cardTitulo: { fontSize: 12, color: '#7F8C8D', fontWeight: 'bold' },
  cardValor: { fontSize: 24, color: '#2C3E50', fontWeight: 'bold', marginTop: 5 },

  tituloSecao: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50', marginBottom: 10, marginTop: 10 },
  vazio: { textAlign: 'center', color: '#95A5A6', fontStyle: 'italic', marginVertical: 20 },
  
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