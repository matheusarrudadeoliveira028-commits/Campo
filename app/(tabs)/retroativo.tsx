import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function RetroativoScreen() {
  const [colaborador, setColaborador] = useState('');
  const [servico, setServico] = useState('');
  const [servicoSelecionadoCompleto, setServicoSelecionadoCompleto] = useState<any>(null);
  
  const [fazenda, setFazenda] = useState('');
  const [quadra, setQuadra] = useState('');
  const [ramal, setRamal] = useState(''); 
  const [quantidade, setQuantidade] = useState('');
  const [valorTotalCalculado, setValorTotalCalculado] = useState(0);
  
  // 👉 Campo de Data Manual
  const [dataManual, setDataManual] = useState('');
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [mapaCompleto, setMapaCompleto] = useState<any[]>([]);
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<string[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<string[]>([]);
  const [ramaisDisponiveis, setRamaisDisponiveis] = useState<any[]>([]);
  const [limitePes, setLimitePes] = useState<number | null>(null);
  
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  const [perfilLogado, setPerfilLogado] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);

  const [modalEquipeVisivel, setModalEquipeVisivel] = useState(false);

  useEffect(() => {
    carregarUsuarioLogado(); 
    
    // Sugere a data de ontem automaticamente para facilitar
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    setDataManual(ontem.toLocaleDateString('pt-BR'));
  }, []);

  // Máscara de Data
  const aplicarMascaraData = (texto: string) => {
    let v = texto.replace(/\D/g, ''); 
    if (v.length > 8) v = v.substring(0, 8); 
    if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{1,4}).*/, '$1/$2/$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1/$2');
    return v;
  };

  const carregarUsuarioLogado = async () => {
    try {
      const perfilSalvoStr = await AsyncStorage.getItem('@perfil_offline');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session && !sessionError) {
        const { data: perfilData, error: perfilError } = await supabase.from('perfis').select('*').eq('id', session.user.id).single();
        
        if (perfilData && !perfilError) {
          setPerfilLogado(perfilData);
          await AsyncStorage.setItem('@perfil_offline', JSON.stringify(perfilData));
          carregarDadosBase();
          setIsOffline(false);
        } else {
          acionarMochilaDePerfil(perfilSalvoStr);
        }
      } else {
        acionarMochilaDePerfil(perfilSalvoStr);
      }
    } catch (e) {
      const perfilSalvoStr = await AsyncStorage.getItem('@perfil_offline');
      acionarMochilaDePerfil(perfilSalvoStr);
    }
  };

  const acionarMochilaDePerfil = (perfilSalvoStr: string | null) => {
    setIsOffline(true);
    if (perfilSalvoStr) {
      const p = JSON.parse(perfilSalvoStr);
      setPerfilLogado(p);
      carregarDadosBase();
    } else {
      router.replace('/');
    }
  };

  const carregarDadosBase = async () => {
    setCarregandoDados(true);
    try {
      const { data: colabs, error: errColab } = await supabase.from('colaboradores').select('*').order('nome');
      const { data: servs, error: errServ } = await supabase.from('servicos').select('*').neq('bloqueado', true).order('nome');
      const { data: mapa, error: errMapa } = await supabase.from('mapa_fazendas').select('*');

      if (errColab || errServ || errMapa) throw new Error("Sem rede");

      if (colabs) { setListaColaboradores(colabs); await AsyncStorage.setItem('@mochila_colaboradores', JSON.stringify(colabs)); }
      if (servs) { setListaServicos(servs); await AsyncStorage.setItem('@mochila_servicos', JSON.stringify(servs)); }
      if (mapa) {
        setMapaCompleto(mapa);
        setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
        await AsyncStorage.setItem('@mochila_mapa', JSON.stringify(mapa));
      }
      setIsOffline(false);
    } catch (error) {
      setIsOffline(true);
      const mochilaColabs = await AsyncStorage.getItem('@mochila_colaboradores');
      const mochilaServs = await AsyncStorage.getItem('@mochila_servicos');
      const mochilaMapa = await AsyncStorage.getItem('@mochila_mapa');

      if (mochilaColabs) setListaColaboradores(JSON.parse(mochilaColabs));
      if (mochilaServs) setListaServicos(JSON.parse(mochilaServs).filter((s: any) => s.bloqueado !== true));
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

  const processarRamaisMuitos = (input: string) => {
    const listaFinal: string[] = [];
    const partes = input.split(',');

    partes.forEach(parte => {
      const trecho = parte.trim();
      if (trecho.includes('-')) {
        const [inicio, fim] = trecho.split('-').map(Number);
        if (!isNaN(inicio) && !isNaN(fim)) {
          for (let i = inicio; i <= fim; i++) {
            listaFinal.push(i.toString());
          }
        }
      } else if (trecho !== '') {
        listaFinal.push(trecho);
      }
    });

    return Array.from(new Set(listaFinal));
  };

  useEffect(() => {
    const listaRamais = processarRamaisMuitos(ramal);
    if (listaRamais.length > 0) {
      let somaLimites = 0;
      let encontrouAlgumComLimite = false;

      listaRamais.forEach(numRamal => {
        const ramalSelecionado = ramaisDisponiveis.find(r => r.ramal === numRamal);
        if (ramalSelecionado && ramalSelecionado.total_pes) {
          somaLimites += ramalSelecionado.total_pes;
          encontrouAlgumComLimite = true;
        }
      });

      setLimitePes(encontrouAlgumComLimite ? somaLimites : null);
    } else {
      setLimitePes(null);
    }
  }, [ramal, ramaisDisponiveis]);

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
      Alert.alert("⚠️ Limite Atingido", `A soma máxima dos ramais selecionados é de ${limitePes} pés!`);
      setQuantidade(limitePes.toString());
    } else {
      setQuantidade(texto);
    }
  };

  const salvarLancamento = async () => {
    if (!colaborador || !servico || !fazenda || !quadra || !ramal || !quantidade || !dataManual) { 
      return Alert.alert("Aviso", "Preencha todos os campos e a data!"); 
    }

    if (dataManual.length !== 10) {
      return Alert.alert("Aviso", "A data deve estar no formato DD/MM/AAAA");
    }

    const listaDeRamaisSelecionados = processarRamaisMuitos(ramal);
    if (listaDeRamaisSelecionados.length === 0) {
      return Alert.alert("Erro", "Formato de ramal inválido.");
    }

    const isServicoAtualCoringa = servicoSelecionadoCompleto?.is_coringa === true;

    for (const numRamal of listaDeRamaisSelecionados) {
      const ramalInfo = ramaisDisponiveis.find(r => r.ramal === numRamal);
      if (ramalInfo?.servico_permitido && servico !== ramalInfo.servico_permitido && !isServicoAtualCoringa) { 
        return Alert.alert("❌ Bloqueado", `O ramal ${numRamal} só aceita: ${ramalInfo.servico_permitido}.`); 
      }
    }

    setSalvando(true);
    let valorUnitario = servicoSelecionadoCompleto?.preco_base || 0;
    if (servicoSelecionadoCompleto?.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;

    const quantidadePorRamal = Math.floor(parseInt(quantidade) / listaDeRamaisSelecionados.length);
    const valorPorRamal = valorTotalCalculado / listaDeRamaisSelecionados.length;

    const partesData = dataManual.split('/');
    const dataIsoParaSalvar = `${partesData[2]}-${partesData[1]}-${partesData[0]}T12:00:00.000Z`;

    try {
      const novosLancamentosMultiplos = listaDeRamaisSelecionados.map(numRamal => ({
        colaborador, 
        servico, 
        fazenda, 
        quadra, 
        ramal: numRamal,
        quantidade: quantidadePorRamal, 
        valor_unitario: valorUnitario, 
        valor_total: valorPorRamal, 
        data: dataIsoParaSalvar, 
        fiscal_nome: perfilLogado?.nome || 'Lançamento Retroativo' 
      }));

      // 👉 SALVA 100% ONLINE DIRETO NO SUPABASE
      const { error } = await supabase.from('diarios_campo').insert(novosLancamentosMultiplos);
      
      if (error) throw error;

      Alert.alert(
        "✅ Sucesso!", 
        `Lançamento retroativo enviado para a nuvem na data ${dataManual}.\nValor total: R$ ${valorTotalCalculado.toFixed(2).replace('.', ',')}`
      );

      setRamal(''); setQuantidade(''); setValorTotalCalculado(0);
    } catch (e: any) {
      Alert.alert(
        "Erro de Conexão", 
        "Você precisa de internet para salvar um retroativo. Verifique sua conexão e tente novamente."
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{flex: 1}}>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>⚠️ ATENÇÃO: Você está sem internet. Retroativos exigem conexão.</Text>
          </View>
        )}

        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
          
          <View style={styles.topBar}>
            {perfilLogado ? (
              <Text style={styles.userText}>👤 {perfilLogado.cargo}: {perfilLogado.nome}</Text>
            ) : (
              <Text style={styles.userText}>Buscando perfil...</Text>
            )}
            <TouchableOpacity onPress={() => setModalEquipeVisivel(true)} style={styles.btnEquipe}>
              <Text style={styles.btnEquipeText}>👥 Todos Colabs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Text style={styles.titleRetro}>Lançamento Retroativo ⏳</Text>
            <Text style={styles.subtitle}>Registro 100% Online de dias anteriores</Text>
            <View style={styles.relogioBox}>
                <Text style={{color: '#FFF', fontWeight: 'bold', marginBottom: 5}}>Data do Serviço:</Text>
                <TextInput 
                  style={styles.inputDataManual} 
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#95A5A6"
                  keyboardType="numeric"
                  maxLength={10}
                  value={dataManual}
                  onChangeText={(t) => setDataManual(aplicarMascaraData(t))}
                />
            </View>
          </View>

          <View style={styles.card}>
            {carregandoDados ? (
              <ActivityIndicator size="large" color="#E67E22" />
            ) : (
              <>
                <Text style={styles.label}>Colaborador:</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                    <Picker.Item label="Quem trabalhou neste dia?" value="" />
                    {listaColaboradores.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
                  </Picker>
                </View>

                <Text style={styles.label}>Serviço:</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={servico} onValueChange={(v) => { setServico(v); setServicoSelecionadoCompleto(listaServicos.find(s => s.nome === v)); }} style={styles.picker}>
                    <Picker.Item label="Qual foi o serviço?" value="" />
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
                    <Text style={styles.label}>Ramal (Ex: 1-4 ou 1,3):</Text>
                    <TextInput 
                      style={[styles.input, !quadra && styles.disabledInput, { height: 50, padding: 10, fontSize: 16 }]} 
                      placeholder="1, 2, 3" 
                      value={ramal} 
                      onChangeText={setRamal} 
                      editable={!!quadra} 
                    />
                  </View>
                </View>

                <Text style={styles.label}>Quantidade (Pés / Tambores):</Text>
                <TextInput style={[styles.input, !ramal && styles.disabledInput]} placeholder="Soma total dos ramais" keyboardType="numeric" value={quantidade} onChangeText={handleMudancaQuantidade} editable={!!ramal} />

                {valorTotalCalculado > 0 && (
                  <View style={styles.cardGanho}>
                    <Text style={styles.textoGanho}>Valor deste lançamento:</Text>
                    <Text style={styles.valorGanho}>R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}</Text>
                  </View>
                )}

                <TouchableOpacity style={[styles.buttonRetro, salvando && styles.buttonDisabled]} onPress={salvarLancamento} disabled={salvando || isOffline}>
                  {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>💾 ENVIAR PARA NUVEM</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <Modal visible={modalEquipeVisivel} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Lista Geral ({listaColaboradores.length})</Text>
              <ScrollView style={{maxHeight: 400}}>
                {listaColaboradores.length === 0 ? (
                  <Text style={styles.textoVazio}>Ninguém cadastrado no sistema.</Text>
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

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F7FA', padding: 20 },
  offlineBadge: { backgroundColor: '#C0392B', padding: 10, alignItems: 'center', justifyContent: 'center' },
  offlineText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5, backgroundColor: '#FFF', padding: 12, borderRadius: 8, elevation: 2 },
  userText: { fontSize: 13, fontWeight: 'bold', color: '#2C3E50', flex: 1 },
  btnEquipe: { backgroundColor: '#3498DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, marginRight: 8 },
  btnEquipeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  header: { marginBottom: 20, marginTop: 10, alignItems: 'center' },
  titleRetro: { fontSize: 26, fontWeight: 'bold', color: '#D35400' }, 
  subtitle: { fontSize: 15, color: '#7F8C8D', textAlign: 'center' },
  relogioBox: { backgroundColor: '#D35400', padding: 15, borderRadius: 8, marginTop: 15, alignItems: 'center', width: '100%' }, 
  inputDataManual: { backgroundColor: '#FFF', width: '60%', padding: 10, borderRadius: 8, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
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
  buttonRetro: { backgroundColor: '#D35400', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 15 }, 
  buttonDisabled: { backgroundColor: '#95A5A6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, textAlign: 'center' },
  textoVazio: { textAlign: 'center', color: '#7F8C8D', marginVertical: 20 },
  itemEquipe: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ECF0F1' },
  nomeEquipe: { fontSize: 16, color: '#34495E', fontWeight: 'bold' },
  btnFecharModal: { backgroundColor: '#95A5A6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  btnFecharTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  btnAtualizar: { backgroundColor: '#E67E22', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  btnAtualizarText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});