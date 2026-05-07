import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function CadastrosScreen() {
  const [abaAtiva, setAbaAtiva] = useState<'colaborador' | 'servico' | 'mapa' | 'setor'>('servico');
  const [salvando, setSalvando] = useState(false);
  
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [listaSetores, setListaSetores] = useState<any[]>([]); 
  const [listaMapas, setListaMapas] = useState<any[]>([]); 

  useEffect(() => {
    carregarServicos();
    carregarSetores();
    carregarMapas();
  }, []);

  const carregarServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('nome');
    if (data) setListaServicos(data);
  };

  const carregarSetores = async () => {
    const { data } = await supabase.from('setores').select('*').order('nome');
    if (data) setListaSetores(data);
  };

  const carregarMapas = async () => {
    const { data } = await supabase.from('mapa_fazendas').select('*').order('fazenda');
    if (data) setListaMapas(data);
  };

  // === ESTADOS: COLABORADOR ===
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [setorColaborador, setSetorColaborador] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');

  // === ESTADOS: SERVIÇO ===
  const [nomeServico, setNomeServico] = useState('');
  const [precoServico, setPrecoServico] = useState('');
  const [tipoCobranca, setTipoCobranca] = useState('milheiro');
  const [isCoringa, setIsCoringa] = useState('nao'); 
  const [editandoServicoId, setEditandoServicoId] = useState<number | null>(null);

  // === ESTADOS: MAPA ===
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [numeroQuadra, setNumeroQuadra] = useState('');
  const [numeroRamal, setNumeroRamal] = useState('');
  const [totalPes, setTotalPes] = useState('');
  const [servicoVinculado, setServicoVinculado] = useState('');
  const [editandoMapaId, setEditandoMapaId] = useState<number | null>(null);

  // === ESTADOS: SETOR ===
  const [nomeSetor, setNomeSetor] = useState('');
  const [editandoSetorId, setEditandoSetorId] = useState<number | null>(null);

  // === MÁSCARA E CONVERSOR DE DATA ===
  const aplicarMascaraData = (texto: string) => {
    let v = texto.replace(/\D/g, ''); 
    if (v.length > 8) v = v.substring(0, 8); 
    if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{1,4}).*/, '$1/$2/$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1/$2');
    return v;
  };

  const converterParaBanco = (dataBR: string) => {
    const partes = dataBR.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return null;
  };

  // === SALVAMENTOS ===
  const salvarColaborador = async () => {
    if (!nomeColaborador || !dataAdmissao || !setorColaborador) {
      return Alert.alert('Erro', 'Preencha o nome, data e setor.');
    }
    if (dataAdmissao.length !== 10) return Alert.alert('Erro', 'Data incompleta.');
    
    setSalvando(true);
    const dataFormatada = converterParaBanco(dataAdmissao);
    
    const { error } = await supabase.from('colaboradores').insert([{ 
      nome: nomeColaborador.toUpperCase(),
      setor: setorColaborador,
      data_admissao: dataFormatada
    }]);
    
    setSalvando(false);
    if (!error) { 
      Alert.alert('Sucesso', 'Cadastrado!'); 
      setNomeColaborador(''); setDataAdmissao(''); setSetorColaborador('');
    } else {
      Alert.alert('Erro', error.message);
    }
  };

  const salvarServico = async () => {
    if (!nomeServico || !precoServico) return Alert.alert('Erro', 'Preencha nome e preço.');
    setSalvando(true);
    
    const precoFormatado = parseFloat(precoServico.replace(',', '.'));
    const coringaBool = isCoringa === 'sim'; 
    
    const payload = { 
      nome: nomeServico, 
      preco_base: precoFormatado, 
      tipo_cobranca: tipoCobranca,
      is_coringa: coringaBool 
    };

    let error;

    if (editandoServicoId) {
      const { error: errUpdate } = await supabase.from('servicos').update(payload).eq('id', editandoServicoId);
      error = errUpdate;
    } else {
      const { error: errInsert } = await supabase.from('servicos').insert([payload]);
      error = errInsert;
    }
    
    setSalvando(false);
    if (!error) { 
      Alert.alert('Sucesso', editandoServicoId ? 'Serviço atualizado!' : 'Serviço cadastrado!'); 
      cancelarEdicaoServico();
      carregarServicos(); 
    } else {
      Alert.alert('Erro', error.message);
    }
  };

  const salvarMapa = async () => {
    if (!nomeFazenda || !numeroQuadra || !numeroRamal || !totalPes || !servicoVinculado) {
      return Alert.alert('Erro', 'Preencha todos os campos do mapa, incluindo o Serviço!');
    }
    setSalvando(true);
    
    const payload = { 
      fazenda: nomeFazenda, 
      quadra: numeroQuadra, 
      ramal: numeroRamal, 
      total_pes: parseInt(totalPes),
      servico_permitido: servicoVinculado
    };

    let error;

    if (editandoMapaId) {
      const { error: errUpdate } = await supabase.from('mapa_fazendas').update(payload).eq('id', editandoMapaId);
      error = errUpdate;
    } else {
      const { error: errInsert } = await supabase.from('mapa_fazendas').insert([payload]);
      error = errInsert;
    }

    setSalvando(false);
    
    if (error) Alert.alert('Erro', error.message);
    else {
      Alert.alert('Sucesso', editandoMapaId ? 'Ramal atualizado!' : 'Ramal cadastrado!');
      cancelarEdicaoMapa();
      carregarMapas();
    }
  };

  const salvarSetor = async () => {
    if (!nomeSetor) return Alert.alert('Erro', 'Digite o nome do setor.');
    setSalvando(true);
    
    const payload = { nome: nomeSetor };
    let error;

    if (editandoSetorId) {
      const { error: errUpdate } = await supabase.from('setores').update(payload).eq('id', editandoSetorId);
      error = errUpdate;
    } else {
      const { error: errInsert } = await supabase.from('setores').insert([payload]);
      error = errInsert;
    }

    setSalvando(false);
    
    if (!error) { 
      Alert.alert('Sucesso', editandoSetorId ? 'Setor atualizado!' : 'Setor cadastrado!'); 
      cancelarEdicaoSetor();
      carregarSetores(); 
    } else {
      Alert.alert('Erro', error.message);
    }
  };

  // === FUNÇÕES DE EDIÇÃO (PREENCHER FORMULÁRIO) ===
  const iniciarEdicaoServico = (item: any) => {
    setNomeServico(item.nome);
    setPrecoServico(item.preco_base ? item.preco_base.toString().replace('.', ',') : '');
    setTipoCobranca(item.tipo_cobranca || 'milheiro');
    setIsCoringa(item.is_coringa ? 'sim' : 'nao');
    setEditandoServicoId(item.id);
  };

  const cancelarEdicaoServico = () => {
    setNomeServico(''); setPrecoServico(''); setTipoCobranca('milheiro'); setIsCoringa('nao'); setEditandoServicoId(null);
  };

  const iniciarEdicaoMapa = (item: any) => {
    setNomeFazenda(item.fazenda);
    setNumeroQuadra(item.quadra);
    setNumeroRamal(item.ramal);
    setTotalPes(item.total_pes ? item.total_pes.toString() : '');
    setServicoVinculado(item.servico_permitido);
    setEditandoMapaId(item.id);
  };

  const cancelarEdicaoMapa = () => {
    setNomeFazenda(''); setNumeroQuadra(''); setNumeroRamal(''); setTotalPes(''); setServicoVinculado(''); setEditandoMapaId(null);
  };

  const iniciarEdicaoSetor = (item: any) => {
    setNomeSetor(item.nome);
    setEditandoSetorId(item.id);
  };

  const cancelarEdicaoSetor = () => {
    setNomeSetor(''); setEditandoSetorId(null);
  };

  // === FUNÇÕES DE EXCLUSÃO ===
  const excluirSetor = (id: number, nome: string) => {
    Alert.alert('Excluir Setor', `Apagar o setor "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim', onPress: async () => { await supabase.from('setores').delete().eq('id', id); carregarSetores(); } }
    ]);
  };

  const excluirServico = (id: number, nome: string) => {
    Alert.alert('Excluir Serviço', `Apagar o serviço "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim', onPress: async () => { await supabase.from('servicos').delete().eq('id', id); carregarServicos(); } }
    ]);
  };

  const excluirMapa = (id: number, fazenda: string, ramal: string) => {
    Alert.alert('Excluir Ramal', `Apagar o Ramal ${ramal} da Fazenda ${fazenda}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim', onPress: async () => { await supabase.from('mapa_fazendas').delete().eq('id', id); carregarMapas(); } }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Painel Admin ⚙️</Text>
        <Text style={styles.subtitle}>Gerenciamento do Sistema</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.menuAbas}>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'servico' && styles.abaAtiva]} onPress={() => setAbaAtiva('servico')}><Text style={[styles.abaTexto, abaAtiva === 'servico' && styles.abaTextoAtivo]}>Serviços</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'mapa' && styles.abaAtiva]} onPress={() => setAbaAtiva('mapa')}><Text style={[styles.abaTexto, abaAtiva === 'mapa' && styles.abaTextoAtivo]}>Mapa</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'setor' && styles.abaAtiva]} onPress={() => setAbaAtiva('setor')}><Text style={[styles.abaTexto, abaAtiva === 'setor' && styles.abaTextoAtivo]}>Setores</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'colaborador' && styles.abaAtiva]} onPress={() => setAbaAtiva('colaborador')}><Text style={[styles.abaTexto, abaAtiva === 'colaborador' && styles.abaTextoAtivo]}>+ Colaborador</Text></TouchableOpacity>
      </ScrollView>

      {abaAtiva === 'colaborador' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Novo Colaborador</Text>
          <Text style={{fontSize: 12, color: '#7F8C8D', marginBottom: 15}}>A gestão e listagem de colaboradores é feita na tela "Gestão de Equipe".</Text>
          
          <Text style={styles.label}>Nome Completo:</Text>
          <TextInput style={styles.input} placeholder="Ex: JOÃO DA SILVA" value={nomeColaborador} onChangeText={setNomeColaborador} autoCapitalize="characters"/>
          
          <Text style={styles.label}>Data de Admissão:</Text>
          <TextInput style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} value={dataAdmissao} onChangeText={(t) => setDataAdmissao(aplicarMascaraData(t))}/>
          
          <Text style={styles.label}>Setor:</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={setorColaborador} onValueChange={setSetorColaborador} style={styles.picker}>
              <Picker.Item label="Selecione o setor..." value="" />
              {listaSetores.map((item) => (
                <Picker.Item key={item.id} label={item.nome} value={item.nome} />
              ))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.button} onPress={salvarColaborador} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
      )}

      {abaAtiva === 'setor' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>{editandoSetorId ? '✏️ Editando Setor' : 'Novo Setor de Trabalho'}</Text>
          <Text style={styles.label}>Nome do Setor:</Text>
          <TextInput style={styles.input} placeholder="Ex: Tratos Culturais" value={nomeSetor} onChangeText={setNomeSetor}/>
          
          {editandoSetorId ? (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, {flex: 1, marginRight: 5, backgroundColor: '#95A5A6'}]} onPress={cancelarEdicaoSetor}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, {flex: 1, marginLeft: 5, backgroundColor: '#F39C12'}]} onPress={salvarSetor} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Atualizar</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.button} onPress={salvarSetor} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Salvar Setor</Text>}
            </TouchableOpacity>
          )}

          <View style={styles.secaoLista}>
            <Text style={styles.tituloLista}>Setores Cadastrados ({listaSetores.length})</Text>
            {listaSetores.map(item => (
              <View key={item.id} style={styles.itemLista}>
                <Text style={styles.itemNome}>{item.nome}</Text>
                <View style={{flexDirection: 'row', gap: 15}}>
                  <TouchableOpacity onPress={() => iniciarEdicaoSetor(item)}><Text style={styles.iconeAcao}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => excluirSetor(item.id, item.nome)}><Text style={styles.iconeAcao}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {abaAtiva === 'servico' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>{editandoServicoId ? '✏️ Editando Serviço' : 'Novo Serviço'}</Text>
          <Text style={styles.label}>Nome:</Text>
          <TextInput style={styles.input} placeholder="Ex: Roçada" value={nomeServico} onChangeText={setNomeServico}/>
          
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Preço Base:</Text><TextInput style={styles.input} placeholder="60,00" value={precoServico} onChangeText={setPrecoServico}/></View>
            <View style={styles.col}>
              <Text style={styles.label}>Cobrado por:</Text>
              <TouchableOpacity style={[styles.input, {justifyContent: 'center', backgroundColor: tipoCobranca === 'milheiro' ? '#D4E6F1' : '#F8FAFC'}]} onPress={() => setTipoCobranca(tipoCobranca === 'milheiro' ? 'unidade' : 'milheiro')}>
                <Text style={{textAlign: 'center'}}>{tipoCobranca === 'milheiro' ? '1000 Pés' : 'Dia/Und.'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>É um Serviço Coringa? (Fura bloqueio do ramal)</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={isCoringa} onValueChange={setIsCoringa} style={styles.picker}>
              <Picker.Item label="Não (Segue a trava do ramal)" value="nao" />
              <Picker.Item label="Sim (Livre em qualquer ramal)" value="sim" />
            </Picker>
          </View>

          {editandoServicoId ? (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, {flex: 1, marginRight: 5, backgroundColor: '#95A5A6'}]} onPress={cancelarEdicaoServico}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, {flex: 1, marginLeft: 5, backgroundColor: '#F39C12'}]} onPress={salvarServico} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Atualizar</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.button} onPress={salvarServico} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Salvar</Text>}
            </TouchableOpacity>
          )}

          <View style={styles.secaoLista}>
            <Text style={styles.tituloLista}>Serviços Cadastrados ({listaServicos.length})</Text>
            {listaServicos.map(item => (
              <View key={item.id} style={styles.itemLista}>
                <View style={{flex: 1}}>
                  <Text style={styles.itemNome}>{item.nome} {item.is_coringa ? '🃏' : ''}</Text>
                  <Text style={styles.itemDetalhe}>R$ {item.preco_base?.toFixed(2)} por {item.tipo_cobranca === 'milheiro' ? '1000 Pés' : 'Unidade'}</Text>
                </View>
                
                <View style={{flexDirection: 'row', gap: 15}}>
                  <TouchableOpacity onPress={() => iniciarEdicaoServico(item)}><Text style={styles.iconeAcao}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => excluirServico(item.id, item.nome)}><Text style={styles.iconeAcao}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {abaAtiva === 'mapa' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>{editandoMapaId ? '✏️ Editando Ramal' : 'Mapear Novo Ramal'}</Text>
          
          <Text style={styles.label}>Fazenda:</Text>
          <TextInput style={styles.input} placeholder="Ex: Boa Vista" value={nomeFazenda} onChangeText={setNomeFazenda}/>

          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Quadra:</Text><TextInput style={styles.input} placeholder="Ex: 12" value={numeroQuadra} onChangeText={setNumeroQuadra}/></View>
            <View style={styles.col}><Text style={styles.label}>Ramal:</Text><TextInput style={styles.input} placeholder="Ex: 5" value={numeroRamal} onChangeText={setNumeroRamal}/></View>
          </View>

          <Text style={styles.label}>Limite de Pés do Ramal:</Text>
          <TextInput style={styles.input} placeholder="Ex: 1500" keyboardType="numeric" value={totalPes} onChangeText={setTotalPes}/>

          <Text style={styles.label}>Serviço Padrão deste Ramal:</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={servicoVinculado} onValueChange={setServicoVinculado} style={styles.picker}>
              <Picker.Item label="Selecione o serviço..." value="" />
              {listaServicos.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
            </Picker>
          </View>

          {editandoMapaId ? (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, {flex: 1, marginRight: 5, backgroundColor: '#95A5A6'}]} onPress={cancelarEdicaoMapa}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, {flex: 1, marginLeft: 5, backgroundColor: '#F39C12'}]} onPress={salvarMapa} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Atualizar</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.button} onPress={salvarMapa} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Salvar Ramal</Text>}
            </TouchableOpacity>
          )}

          <View style={styles.secaoLista}>
            <Text style={styles.tituloLista}>Mapa Atual ({listaMapas.length} Ramais)</Text>
            {listaMapas.map(item => (
              <View key={item.id} style={styles.itemLista}>
                <View style={{flex: 1}}>
                  <Text style={styles.itemNome}>Fz: {item.fazenda} | Q: {item.quadra} | R: {item.ramal}</Text>
                  <Text style={styles.itemDetalhe}>Capacidade: {item.total_pes} pés</Text>
                  <Text style={styles.itemDetalhe}>Serviço Autorizado: {item.servico_permitido}</Text>
                </View>
                <View style={{flexDirection: 'row', gap: 15}}>
                  <TouchableOpacity onPress={() => iniciarEdicaoMapa(item)}><Text style={styles.iconeAcao}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => excluirMapa(item.id, item.fazenda, item.ramal)}><Text style={styles.iconeAcao}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  menuAbas: { flexDirection: 'row', backgroundColor: '#E0E6ED', borderRadius: 10, padding: 4, marginBottom: 20, maxHeight: 50 },
  abaBotao: { paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  abaAtiva: { backgroundColor: '#FFFFFF', elevation: 2 },
  abaTexto: { fontWeight: 'bold', color: '#7F8C8D' },
  abaTextoAtivo: { color: '#2980B9' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 10 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8FAFC', height: 50 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  col: { width: '48%' },
  button: { backgroundColor: '#2980B9', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  secaoLista: { marginTop: 40, borderTopWidth: 1, borderColor: '#E0E6ED', paddingTop: 20 },
  tituloLista: { fontSize: 16, fontWeight: 'bold', color: '#34495E', marginBottom: 15 },
  itemLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E0E6ED' },
  itemNome: { fontSize: 15, fontWeight: 'bold', color: '#2C3E50' },
  itemDetalhe: { fontSize: 12, color: '#7F8C8D', marginTop: 2 },
  iconeAcao: { fontSize: 20 }
});