import AsyncStorage from '@react-native-async-storage/async-storage'; // Necessário instalar: npx expo install @react-native-async-storage/async-storage
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function HomeScreen() {
  const [colaborador, setColaborador] = useState('');
  const [servico, setServico] = useState('');
  const [servicoSelecionadoCompleto, setServicoSelecionadoCompleto] = useState<any>(null);
  
  const [fazenda, setFazenda] = useState('');
  const [quadra, setQuadra] = useState('');
  const [ramal, setRamal] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotalCalculado, setValorTotalCalculado] = useState(0);
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [mapaCompleto, setMapaCompleto] = useState<any[]>([]);
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<string[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<string[]>([]);
  const [ramaisDisponiveis, setRamaisDisponiveis] = useState<any[]>([]);
  const [limitePes, setLimitePes] = useState<number | null>(null);
  
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [dataHoraAtual, setDataHoraAtual] = useState(new Date());

  // NOVOS ESTADOS PARA MODO OFFLINE
  const [lancamentosPendentes, setLancamentosPendentes] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setDataHoraAtual(new Date()), 1000);
    carregarDadosBase();
    carregarLancamentosLocais(); // Carrega o que está guardado no celular
    return () => clearInterval(timer);
  }, []);

  const carregarLancamentosLocais = async () => {
    try {
      const dados = await AsyncStorage.getItem('@lancamentos_off');
      if (dados) setLancamentosPendentes(JSON.parse(dados));
    } catch (e) {
      console.log("Erro ao carregar dados locais");
    }
  };

  const carregarDadosBase = async () => {
    setCarregandoDados(true);
    const { data: colabs } = await supabase.from('colaboradores').select('*').order('nome');
    if (colabs) setListaColaboradores(colabs);
    const { data: servs } = await supabase.from('servicos').select('*').order('nome');
    if (servs) setListaServicos(servs);
    const { data: mapa } = await supabase.from('mapa_fazendas').select('*');
    if (mapa) {
      setMapaCompleto(mapa);
      setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
    }
    setCarregandoDados(false);
  };

  useEffect(() => {
    setQuadra(''); setRamal(''); setLimitePes(null);
    if (fazenda) setQuadrasDisponiveis([...new Set(mapaCompleto.filter(m => m.fazenda === fazenda).map(m => m.quadra))] as string[]);
    else setQuadrasDisponiveis([]);
  }, [fazenda]);

  useEffect(() => {
    setRamal(''); setLimitePes(null);
    if (quadra) setRamaisDisponiveis(mapaCompleto.filter(m => m.fazenda === fazenda && m.quadra === quadra));
    else setRamaisDisponiveis([]);
  }, [quadra]);

  useEffect(() => {
    if (ramal) {
      const ramalSelecionado = ramaisDisponiveis.find(r => r.ramal === ramal);
      if (ramalSelecionado) setLimitePes(ramalSelecionado.total_pes);
    } else setLimitePes(null);
  }, [ramal]);

  useEffect(() => {
    if (servicoSelecionadoCompleto && quantidade) {
      const qtdNum = parseInt(quantidade) || 0;
      let valorUnitario = servicoSelecionadoCompleto.preco_base || 0;
      if (servicoSelecionadoCompleto.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;
      setValorTotalCalculado(qtdNum * valorUnitario);
    } else setValorTotalCalculado(0);
  }, [servicoSelecionadoCompleto, quantidade]);

  const handleMudancaQuantidade = (texto: string) => {
    const valorDigitado = parseInt(texto) || 0;
    if (limitePes !== null && valorDigitado > limitePes) {
      alert(`⚠️ Limite do ramal é ${limitePes} pés!`);
      setQuantidade(limitePes.toString());
    } else setQuantidade(texto);
  };

  // FUNÇÃO DE SALVAMENTO OFFLINE (NO CELULAR)
  const salvarLancamento = async () => {
    if (!colaborador || !servico || !fazenda || !quadra || !ramal || !quantidade) {
      return Alert.alert("Aviso", "Preencha todos os campos!");
    }
    
    const ramalInfo = ramaisDisponiveis.find(r => r.ramal === ramal);
    
    if (ramalInfo?.servico_permitido && servico !== ramalInfo.servico_permitido) {
      return Alert.alert("❌ Bloqueado", `Este ramal só aceita: ${ramalInfo.servico_permitido}`);
    }

    if (ramalInfo?.data_bloqueio) {
      const hojeISO = dataHoraAtual.toISOString().split('T')[0];
      if (hojeISO !== ramalInfo.data_bloqueio) {
        return Alert.alert("📅 Data Bloqueada", `Lançamentos permitidos apenas em: ${new Date(ramalInfo.data_bloqueio + 'T00:00:00').toLocaleDateString('pt-BR')}`);
      }
    }

    setSalvando(true);
    let valorUnitario = servicoSelecionadoCompleto.preco_base || 0;
    if (servicoSelecionadoCompleto.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;

    // Criamos o objeto do lançamento
    const novoLancamento = {
      colaborador, 
      servico, 
      fazenda, 
      quadra, 
      ramal, 
      quantidade: parseInt(quantidade), 
      valor_unitario: valorUnitario, 
      valor_total: valorTotalCalculado,
      data: dataHoraAtual.toISOString() 
    };

    try {
      // Salva na lista pendente local
      const novaLista = [...lancamentosPendentes, novoLancamento];
      await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
      setLancamentosPendentes(novaLista);

      Alert.alert("✅ Salvo no Celular", "Lançamento registrado offline. Lembre-se de sincronizar ao final do dia!");
      setRamal(''); setQuantidade(''); setValorTotalCalculado(0);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar no armazenamento interno.");
    } finally {
      setSalvando(false);
    }
  };

  // FUNÇÃO PARA ENVIAR TUDO PRO SUPABASE (QUANDO TIVER INTERNET)
  const sincronizarComBanco = async () => {
    if (lancamentosPendentes.length === 0) return;

    setSincronizando(true);
    try {
      const { error } = await supabase.from('diarios_campo').insert(lancamentosPendentes);

      if (error) throw error;

      // Se deu certo, limpa o celular
      await AsyncStorage.removeItem('@lancamentos_off');
      setLancamentosPendentes([]);
      Alert.alert("🚀 Sincronizado!", "Todos os lançamentos foram enviados para o servidor.");
    } catch (e: any) {
      Alert.alert("Erro na Sincronização", "Verifique sua conexão: " + e.message);
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Axoryn Campo 🚜</Text>
        <Text style={styles.subtitle}>Registro de Produção Diária</Text>
        
        <View style={styles.relogioBox}>
            <Text style={styles.relogioTexto}>
                {dataHoraAtual.toLocaleDateString('pt-BR')} - {dataHoraAtual.toLocaleTimeString('pt-BR')}
            </Text>
            <Text style={styles.relogioAviso}>MODO OFFLINE ATIVO</Text>
        </View>
      </View>

      {/* BOTÃO DE SINCRONIZAÇÃO (APARECE SÓ SE TIVER DADOS) */}
      {lancamentosPendentes.length > 0 && (
        <View style={styles.syncCard}>
          <Text style={styles.syncTexto}>📦 {lancamentosPendentes.length} lançamentos pendentes</Text>
          <TouchableOpacity 
            style={styles.btnSync} 
            onPress={sincronizarComBanco}
            disabled={sincronizando}
          >
            {sincronizando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSyncTexto}>SINCRONIZAR COM O BANCO</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        {carregandoDados ? (
          <ActivityIndicator size="large" color="#27AE60" />
        ) : (
          <>
            <Text style={styles.label}>Colaborador:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                <Picker.Item label="Quem está trabalhando?" value="" />
                {listaColaboradores.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
              </Picker>
            </View>

            <Text style={styles.label}>Serviço:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={servico} onValueChange={(v) => { setServico(v); setServicoSelecionadoCompleto(listaServicos.find(s => s.nome === v)); }} style={styles.picker}>
                <Picker.Item label="Qual o serviço?" value="" />
                {listaServicos.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
              </Picker>
            </View>

            <Text style={styles.label}>Fazenda:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={fazenda} onValueChange={setFazenda} style={styles.picker}>
                <Picker.Item label="Selecione a fazenda..." value="" />
                {fazendasDisponiveis.map((f, i) => (<Picker.Item key={i} label={f} value={f} />))}
              </Picker>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Quadra:</Text>
                <View style={[styles.pickerContainer, !fazenda && styles.disabled]}><Picker enabled={!!fazenda} selectedValue={quadra} onValueChange={setQuadra} style={styles.picker}><Picker.Item label="..." value="" />{quadrasDisponiveis.map((q, i) => (<Picker.Item key={i} label={q} value={q} />))}</Picker></View>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Ramal:</Text>
                <View style={[styles.pickerContainer, !quadra && styles.disabled]}><Picker enabled={!!quadra} selectedValue={ramal} onValueChange={setRamal} style={styles.picker}><Picker.Item label="..." value="" />{ramaisDisponiveis.map((r, i) => (<Picker.Item key={i} label={r.ramal} value={r.ramal} />))}</Picker></View>
              </View>
            </View>

            <Text style={styles.label}>Quantidade (Pés):</Text>
            <TextInput style={[styles.input, !ramal && styles.disabledInput]} placeholder="0" keyboardType="numeric" value={quantidade} onChangeText={handleMudancaQuantidade} editable={!!ramal} />

            {valorTotalCalculado > 0 && (
              <View style={styles.cardGanho}>
                <Text style={styles.textoGanho}>Valor deste lançamento:</Text>
                <Text style={styles.valorGanho}>R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.button, salvando && styles.buttonDisabled]} onPress={salvarLancamento} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>💾 SALVAR NO CELULAR</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D' },
  relogioBox: { backgroundColor: '#34495E', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center', width: '100%' },
  relogioTexto: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  relogioAviso: { color: '#F1C40F', fontSize: 9, fontWeight: 'bold', marginTop: 3 },
  
  // ESTILO DO CARD DE SINCRONIZAÇÃO
  syncCard: { backgroundColor: '#F39C12', padding: 15, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  syncTexto: { color: '#FFF', fontWeight: 'bold', marginBottom: 10 },
  btnSync: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnSyncTexto: { color: '#F39C12', fontWeight: 'bold' },

  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  disabled: { backgroundColor: '#EAECEE', opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 18, backgroundColor: '#F8FAFC', height: 55 },
  disabledInput: { backgroundColor: '#EAECEE' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  cardGanho: { backgroundColor: '#E8F8F5', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', borderLeftWidth: 5, borderLeftColor: '#27AE60' },
  textoGanho: { color: '#1E8449', fontSize: 13, fontWeight: 'bold' },
  valorGanho: { color: '#1E8449', fontSize: 24, fontWeight: '900' },
  button: { backgroundColor: '#2980B9', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  buttonDisabled: { backgroundColor: '#95A5A6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});