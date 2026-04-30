import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function CadastrosScreen() {
  const [abaAtiva, setAbaAtiva] = useState<'colaborador' | 'servico' | 'mapa'>('colaborador');
  const [salvando, setSalvando] = useState(false);
  const [listaServicos, setListaServicos] = useState<any[]>([]);

  // Carrega os serviços para aparecerem no form do Mapa
  useEffect(() => {
    carregarServicos();
  }, []);

  const carregarServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('nome');
    if (data) setListaServicos(data);
  };

  // Estados: Colaborador
  const [nomeColaborador, setNomeColaborador] = useState('');

  // Estados: Serviço
  const [nomeServico, setNomeServico] = useState('');
  const [precoServico, setPrecoServico] = useState('');
  const [tipoCobranca, setTipoCobranca] = useState('milheiro');

  // Estados: Mapa
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [numeroQuadra, setNumeroQuadra] = useState('');
  const [numeroRamal, setNumeroRamal] = useState('');
  const [totalPes, setTotalPes] = useState('');
  const [servicoVinculado, setServicoVinculado] = useState(''); // NOVO ESTADO

  const salvarColaborador = async () => {
    if (!nomeColaborador) return Alert.alert('Erro', 'Preencha o nome.');
    setSalvando(true);
    const { error } = await supabase.from('colaboradores').insert([{ nome: nomeColaborador }]);
    setSalvando(false);
    if (!error) { Alert.alert('Sucesso', 'Cadastrado!'); setNomeColaborador(''); }
  };

  const salvarServico = async () => {
    if (!nomeServico || !precoServico) return Alert.alert('Erro', 'Preencha nome e preço.');
    setSalvando(true);
    const precoFormatado = parseFloat(precoServico.replace(',', '.'));
    const { error } = await supabase.from('servicos').insert([{ nome: nomeServico, preco_base: precoFormatado, tipo_cobranca: tipoCobranca }]);
    setSalvando(false);
    if (!error) { Alert.alert('Sucesso', 'Serviço cadastrado!'); setNomeServico(''); setPrecoServico(''); carregarServicos(); }
  };

  const salvarMapa = async () => {
    if (!nomeFazenda || !numeroQuadra || !numeroRamal || !totalPes || !servicoVinculado) {
      return Alert.alert('Erro', 'Preencha todos os campos do mapa, incluindo o Serviço!');
    }
    setSalvando(true);
    const { error } = await supabase.from('mapa_fazendas').insert([{ 
      fazenda: nomeFazenda, 
      quadra: numeroQuadra, 
      ramal: numeroRamal, 
      total_pes: parseInt(totalPes),
      servico_permitido: servicoVinculado // SALVANDO O SERVIÇO VINCULADO
    }]);
    setSalvando(false);
    
    if (error) Alert.alert('Erro', error.message);
    else {
      Alert.alert('Sucesso', 'Ramal cadastrado e vinculado ao serviço!');
      setNumeroRamal(''); setTotalPes(''); // Limpa para facilitar cadastro do próx ramal
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Painel Admin ⚙️</Text>
        <Text style={styles.subtitle}>Gerenciamento do Sistema</Text>
      </View>

      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'colaborador' && styles.abaAtiva]} onPress={() => setAbaAtiva('colaborador')}><Text style={[styles.abaTexto, abaAtiva === 'colaborador' && styles.abaTextoAtivo]}>Equipe</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'servico' && styles.abaAtiva]} onPress={() => setAbaAtiva('servico')}><Text style={[styles.abaTexto, abaAtiva === 'servico' && styles.abaTextoAtivo]}>Serviços</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'mapa' && styles.abaAtiva]} onPress={() => setAbaAtiva('mapa')}><Text style={[styles.abaTexto, abaAtiva === 'mapa' && styles.abaTextoAtivo]}>Mapa</Text></TouchableOpacity>
      </View>

      {abaAtiva === 'colaborador' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Novo Colaborador</Text>
          <Text style={styles.label}>Nome Completo:</Text>
          <TextInput style={styles.input} placeholder="Ex: João da Silva" value={nomeColaborador} onChangeText={setNomeColaborador}/>
          <TouchableOpacity style={styles.button} onPress={salvarColaborador}><Text style={styles.buttonText}>Salvar</Text></TouchableOpacity>
        </View>
      )}

      {abaAtiva === 'servico' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Novo Serviço</Text>
          <Text style={styles.label}>Nome:</Text>
          <TextInput style={styles.input} placeholder="Ex: Estria (v)" value={nomeServico} onChangeText={setNomeServico}/>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Preço Base:</Text><TextInput style={styles.input} placeholder="60,00" value={precoServico} onChangeText={setPrecoServico}/></View>
            <View style={styles.col}>
              <Text style={styles.label}>Cobrado por:</Text>
              <TouchableOpacity style={[styles.input, {justifyContent: 'center', backgroundColor: tipoCobranca === 'milheiro' ? '#D4E6F1' : '#F8FAFC'}]} onPress={() => setTipoCobranca(tipoCobranca === 'milheiro' ? 'unidade' : 'milheiro')}>
                <Text style={{textAlign: 'center'}}>{tipoCobranca === 'milheiro' ? '1000 Pés' : 'Dia/Und.'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.button} onPress={salvarServico}><Text style={styles.buttonText}>Salvar</Text></TouchableOpacity>
        </View>
      )}

      {abaAtiva === 'mapa' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Mapear Novo Ramal</Text>
          
          <Text style={styles.label}>Fazenda:</Text>
          <TextInput style={styles.input} placeholder="Ex: Boa Vista" value={nomeFazenda} onChangeText={setNomeFazenda}/>

          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Quadra:</Text><TextInput style={styles.input} placeholder="Ex: 12" value={numeroQuadra} onChangeText={setNumeroQuadra}/></View>
            <View style={styles.col}><Text style={styles.label}>Ramal:</Text><TextInput style={styles.input} placeholder="Ex: 5" value={numeroRamal} onChangeText={setNumeroRamal}/></View>
          </View>

          <Text style={styles.label}>Limite de Pés do Ramal:</Text>
          <TextInput style={styles.input} placeholder="Ex: 1500" keyboardType="numeric" value={totalPes} onChangeText={setTotalPes}/>

          {/* NOVO CAMPO: VINCULAR SERVIÇO */}
          <Text style={styles.label}>Qual serviço pode ser feito aqui?</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={servicoVinculado} onValueChange={setServicoVinculado} style={styles.picker}>
              <Picker.Item label="Selecione o serviço..." value="" />
              {listaServicos.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.button} onPress={salvarMapa}><Text style={styles.buttonText}>Salvar Ramal</Text></TouchableOpacity>
        </View>
      )}
      <View style={{height: 50}} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  menuAbas: { flexDirection: 'row', backgroundColor: '#E0E6ED', borderRadius: 10, padding: 4, marginBottom: 20 },
  abaBotao: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  abaAtiva: { backgroundColor: '#FFFFFF', elevation: 2 },
  abaTexto: { fontWeight: 'bold', color: '#7F8C8D' },
  abaTextoAtivo: { color: '#2980B9' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 10 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8FAFC', height: 50 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  button: { backgroundColor: '#2980B9', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});