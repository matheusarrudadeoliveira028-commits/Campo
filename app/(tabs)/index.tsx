import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  const [perfilLogado, setPerfilLogado] = useState<any>(null);
  const [lancamentosPendentes, setLancamentosPendentes] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  // NOVOS ESTADOS PARA OS MODAIS (TELAS SOBREPOSTAS)
  const [modalEquipeVisivel, setModalEquipeVisivel] = useState(false);
  const [modalPendentesVisivel, setModalPendentesVisivel] = useState(false);

  useEffect(() => {
    carregarUsuarioLogado(); 
    const timer = setInterval(() => setDataHoraAtual(new Date()), 1000);
    carregarLancamentosLocais(); 
    return () => clearInterval(timer);
  }, []);

  const carregarUsuarioLogado = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.from('perfis').select('*').eq('id', user.id).single();
        if (data && !error) {
          setPerfilLogado(data);
          await AsyncStorage.setItem('@perfil_offline', JSON.stringify(data));
          carregarDadosBase(data, user.id);
        } else {
          const perfilSalvo = await AsyncStorage.getItem('@perfil_offline');
          if (perfilSalvo) {
            const perfilParsed = JSON.parse(perfilSalvo);
            setPerfilLogado(perfilParsed);
            carregarDadosBase(perfilParsed, user.id);
          } else {
            const perfilGen = { nome: user.email?.split('@')[0].toUpperCase() || 'USUÁRIO', cargo: 'Sessão Local' };
            setPerfilLogado(perfilGen);
            carregarDadosBase(perfilGen, user.id);
          }
        }
      } else {
        setPerfilLogado({ nome: 'Desconhecido', cargo: 'Sem Sessão' });
        carregarDadosBase(null, null);
      }
    } catch (e) {
      const perfilSalvo = await AsyncStorage.getItem('@perfil_offline');
      if (perfilSalvo) {
        const perfilParsed = JSON.parse(perfilSalvo);
        setPerfilLogado(perfilParsed);
        carregarDadosBase(perfilParsed, perfilParsed.id);
      } else {
        setPerfilLogado({ nome: 'Modo Local', cargo: 'Sessão Salva' });
        carregarDadosBase(null, null);
      }
    }
  };

  const fazerLogout = () => {
    Alert.alert("Sair do Sistema", "⚠️ Atenção: Se você sair, precisará de internet para entrar novamente. Deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim, Sair", onPress: async () => { setPerfilLogado(null); await AsyncStorage.removeItem('@perfil_offline'); await supabase.auth.signOut(); router.replace('/'); } }
    ]);
  };

  const carregarLancamentosLocais = async () => {
    try {
      const dados = await AsyncStorage.getItem('@lancamentos_off');
      if (dados) setLancamentosPendentes(JSON.parse(dados));
    } catch (e) {
      console.log("Erro ao carregar dados locais");
    }
  };

  const carregarDadosBase = async (perfilLido: any, userIdLido: string | null) => {
    setCarregandoDados(true);
    try {
      let queryColaboradores = supabase.from('colaboradores').select('*').order('nome');
      if (perfilLido?.cargo === 'Fiscal de Campo' && userIdLido) {
        queryColaboradores = queryColaboradores.eq('fiscal_id', userIdLido);
      }
      const { data: colabs, error: errColab } = await queryColaboradores;
      const { data: servs, error: errServ } = await supabase.from('servicos').select('*').order('nome');
      const { data: mapa, error: errMapa } = await supabase.from('mapa_fazendas').select('*');

      if (errColab || errServ || errMapa) throw new Error("Sem rede");

      if (colabs) { setListaColaboradores(colabs); await AsyncStorage.setItem('@mochila_colaboradores', JSON.stringify(colabs)); }
      if (servs) { setListaServicos(servs); await AsyncStorage.setItem('@mochila_servicos', JSON.stringify(servs)); }
      if (mapa) {
        setMapaCompleto(mapa);
        setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
        await AsyncStorage.setItem('@mochila_mapa', JSON.stringify(mapa));
      }
    } catch (error) {
      console.log("Modo Offline Ativado");
      const mochilaColabs = await AsyncStorage.getItem('@mochila_colaboradores');
      const mochilaServs = await AsyncStorage.getItem('@mochila_servicos');
      const mochilaMapa = await AsyncStorage.getItem('@mochila_mapa');

      if (mochilaColabs) {
        let colabsParsed = JSON.parse(mochilaColabs);
        if (perfilLido?.cargo === 'Fiscal de Campo' && userIdLido) {
          colabsParsed = colabsParsed.filter((c: any) => c.fiscal_id === userIdLido);
        }
        setListaColaboradores(colabsParsed);
      }
      if (mochilaServs) setListaServicos(JSON.parse(mochilaServs));
      if (mochilaMapa) {
        const mapaParsed = JSON.parse(mochilaMapa);
        setMapaCompleto(mapaParsed);
        setFazendasDisponiveis([...new Set(mapaParsed.map((item: any) => item.fazenda))] as string[]);
      }
    }
    setCarregandoDados(false);
  };

  const atualizarMochilaManual = () => { carregarUsuarioLogado(); Alert.alert("Atualizando", "Buscando dados na nuvem..."); };

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

  const salvarLancamento = async () => {
    if (!colaborador || !servico || !fazenda || !quadra || !ramal || !quantidade) { return Alert.alert("Aviso", "Preencha todos os campos!"); }
    const ramalInfo = ramaisDisponiveis.find(r => r.ramal === ramal);
    if (ramalInfo?.servico_permitido && servico !== ramalInfo.servico_permitido) { return Alert.alert("❌ Bloqueado", `Este ramal só aceita: ${ramalInfo.servico_permitido}`); }
    if (ramalInfo?.data_bloqueio) {
      const hojeISO = dataHoraAtual.toISOString().split('T')[0];
      if (hojeISO !== ramalInfo.data_bloqueio) { return Alert.alert("📅 Data Bloqueada", `Lançamentos permitidos apenas em: ${new Date(ramalInfo.data_bloqueio + 'T00:00:00').toLocaleDateString('pt-BR')}`); }
    }

    setSalvando(true);
    let valorUnitario = servicoSelecionadoCompleto?.preco_base || 0;
    if (servicoSelecionadoCompleto?.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;

    const novoLancamento = { colaborador, servico, fazenda, quadra, ramal, quantidade: parseInt(quantidade), valor_unitario: valorUnitario, valor_total: valorTotalCalculado, data: dataHoraAtual.toISOString() };

    try {
      const novaLista = [...lancamentosPendentes, novoLancamento];
      await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
      setLancamentosPendentes(novaLista);
      Alert.alert("✅ Salvo", "Lançamento registrado offline!");
      setRamal(''); setQuantidade(''); setValorTotalCalculado(0);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar no armazenamento interno.");
    } finally {
      setSalvando(false);
    }
  };

  const sincronizarComBanco = async () => {
    if (lancamentosPendentes.length === 0) return;
    setSincronizando(true);
    try {
      const { error } = await supabase.from('diarios_campo').insert(lancamentosPendentes);
      if (error) throw error;
      await AsyncStorage.removeItem('@lancamentos_off');
      setLancamentosPendentes([]);
      Alert.alert("🚀 Sincronizado!", "Todos os lançamentos foram enviados para o servidor.");
    } catch (e: any) {
      Alert.alert("Erro na Sincronização", "Verifique sua conexão: " + e.message);
    } finally {
      setSincronizando(false);
    }
  };

  // FUNÇÕES DE EXCLUSÃO E EDIÇÃO
  const excluirLancamentoPendente = async (index: number) => {
    Alert.alert("Excluir Lançamento", "Tem certeza que deseja apagar este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim, Apagar", onPress: async () => {
          const novaLista = [...lancamentosPendentes];
          novaLista.splice(index, 1); // Remove o item
          await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
          setLancamentosPendentes(novaLista);
        }
      }
    ]);
  };

  const editarLancamentoPendente = async (index: number) => {
    const item = lancamentosPendentes[index];
    // Apaga da lista de pendentes e joga os dados de volta pros campos
    const novaLista = [...lancamentosPendentes];
    novaLista.splice(index, 1);
    await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
    setLancamentosPendentes(novaLista);

    setColaborador(item.colaborador);
    setServico(item.servico);
    setFazenda(item.fazenda);
    setQuadra(item.quadra);
    // Para ramal aparecer certo, o usuário precisará re-selecionar o ramal caso as listas não tenham carregado
    
    setModalPendentesVisivel(false);
    Alert.alert("Modo Edição", "Os dados voltaram para a tela. Altere o que precisar (selecione o ramal novamente se necessário) e clique em Salvar no Celular.");
  };

  return (
    <View style={{flex: 1}}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* BARRA SUPERIOR DE LOGIN */}
        <View style={styles.topBar}>
          {perfilLogado ? (
            <Text style={styles.userText}>👤 {perfilLogado.nome}</Text>
          ) : (
            <Text style={styles.userText}>Buscando perfil...</Text>
          )}
          
          <TouchableOpacity onPress={() => setModalEquipeVisivel(true)} style={styles.btnEquipe}>
            <Text style={styles.btnEquipeText}>👥 Equipe</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={fazerLogout} style={styles.btnLogout}>
            <Text style={styles.btnLogoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Axoryn Campo 🚜</Text>
          <Text style={styles.subtitle}>Registro de Produção Diária</Text>
          
          <View style={styles.relogioBox}>
              <Text style={styles.relogioTexto}>
                  {dataHoraAtual.toLocaleDateString('pt-BR')} - {dataHoraAtual.toLocaleTimeString('pt-BR')}
              </Text>
              <TouchableOpacity onPress={atualizarMochilaManual} style={styles.btnAtualizar}>
                 <Text style={styles.btnAtualizarText}>🔄 Atualizar Base de Dados</Text>
              </TouchableOpacity>
          </View>
        </View>

        {lancamentosPendentes.length > 0 && (
          <View style={styles.syncCard}>
            <Text style={styles.syncTexto}>📦 {lancamentosPendentes.length} lançamentos pendentes</Text>
            
            <View style={styles.syncBotoesRow}>
              <TouchableOpacity style={styles.btnSyncVer} onPress={() => setModalPendentesVisivel(true)}>
                <Text style={styles.btnSyncVerTexto}>✏️ VER / EDITAR</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSync} onPress={sincronizarComBanco} disabled={sincronizando}>
                {sincronizando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSyncTexto}>🚀 ENVIAR TUDO</Text>}
              </TouchableOpacity>
            </View>
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

      {/* MODAL 1: LISTA DA EQUIPE */}
      <Modal visible={modalEquipeVisivel} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Minha Equipe ({listaColaboradores.length})</Text>
            <ScrollView style={{maxHeight: 400}}>
              {listaColaboradores.length === 0 ? (
                <Text style={styles.textoVazio}>Ninguém vinculado a você ainda.</Text>
              ) : (
                listaColaboradores.map(c => (
                  <View key={c.id} style={styles.itemEquipe}>
                    <Text style={styles.nomeEquipe}>👷 {c.nome}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalEquipeVisivel(false)}>
              <Text style={styles.btnFecharTexto}>FECHAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDITAR/EXCLUIR PENDENTES */}
      <Modal visible={modalPendentesVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentGrande}>
            <Text style={styles.modalTitle}>Lançamentos Pendentes</Text>
            <ScrollView style={{maxHeight: 500}}>
              {lancamentosPendentes.length === 0 ? (
                <Text style={styles.textoVazio}>Nenhum lançamento offline.</Text>
              ) : (
                lancamentosPendentes.map((item, index) => (
                  <View key={index} style={styles.itemPendente}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemColab}>{item.colaborador}</Text>
                      <Text style={styles.itemDetalhes}>{item.servico} | Ramal: {item.ramal}</Text>
                      <Text style={styles.itemDetalhes}>Qtd: {item.quantidade} | R$ {item.valor_total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.itemAcoes}>
                      <TouchableOpacity style={styles.btnEditarPendente} onPress={() => editarLancamentoPendente(index)}>
                        <Text style={styles.btnAcaoTexto}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnApagarPendente} onPress={() => excluirLancamentoPendente(index)}>
                        <Text style={styles.btnAcaoTexto}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalPendentesVisivel(false)}>
              <Text style={styles.btnFecharTexto}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F7FA', padding: 20 },
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5, backgroundColor: '#FFF', padding: 12, borderRadius: 8, elevation: 2 },
  userText: { fontSize: 13, fontWeight: 'bold', color: '#2C3E50', flex: 1 },
  
  btnEquipe: { backgroundColor: '#3498DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, marginRight: 8 },
  btnEquipeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  
  btnLogout: { backgroundColor: '#E74C3C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  btnLogoutText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  header: { marginBottom: 20, marginTop: 10, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D' },
  relogioBox: { backgroundColor: '#34495E', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center', width: '100%' },
  relogioTexto: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  btnAtualizar: { backgroundColor: '#27AE60', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  btnAtualizarText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  
  syncCard: { backgroundColor: '#F39C12', padding: 15, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  syncTexto: { color: '#FFF', fontWeight: 'bold', marginBottom: 10 },
  syncBotoesRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  btnSyncVer: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
  btnSyncVerTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  btnSync: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
  btnSyncTexto: { color: '#F39C12', fontWeight: 'bold', fontSize: 12 },

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

  // ESTILOS DOS MODAIS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10 },
  modalContentGrande: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10, flex: 0.9 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, textAlign: 'center' },
  textoVazio: { textAlign: 'center', color: '#7F8C8D', marginVertical: 20 },
  
  itemEquipe: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ECF0F1' },
  nomeEquipe: { fontSize: 16, color: '#34495E', fontWeight: 'bold' },

  itemPendente: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 12, marginBottom: 10, alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemColab: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  itemDetalhes: { fontSize: 13, color: '#7F8C8D', marginTop: 2 },
  itemAcoes: { flexDirection: 'row', gap: 10 },
  btnEditarPendente: { backgroundColor: '#F1C40F', padding: 10, borderRadius: 8 },
  btnApagarPendente: { backgroundColor: '#E74C3C', padding: 10, borderRadius: 8 },
  btnAcaoTexto: { fontSize: 16 },

  btnFecharModal: { backgroundColor: '#95A5A6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  btnFecharTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});