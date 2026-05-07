import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function ColaboradoresScreen() {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [listaSetores, setListaSetores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal de Cadastro/Edição
  const [modalVisivel, setModalVisivel] = useState(false);
  const [nome, setNome] = useState('');
  const [setor, setSetor] = useState(''); 
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // NOVO: Controle de edição
  const [editandoColaboradorId, setEditandoColaboradorId] = useState<number | null>(null);

  useEffect(() => {
    carregarDadosBase();
  }, []);

  const carregarDadosBase = async () => {
    setCarregando(true);
    
    // Carrega Colaboradores
    const { data: dataColabs } = await supabase.from('colaboradores').select('*').order('nome', { ascending: true });
    if (dataColabs) {
      setColaboradores(dataColabs);
      await AsyncStorage.setItem('@mochila_colaboradores', JSON.stringify(dataColabs));
    }

    // Carrega Setores para o Picker
    const { data: dataSetores } = await supabase.from('setores').select('*').order('nome', { ascending: true });
    if (dataSetores) {
      setListaSetores(dataSetores);
    }
    
    setCarregando(false);
  };

  // MÁSCARA DA DATA DE ADMISSÃO (01/01/2026)
  const aplicarMascaraData = (texto: string) => {
    let v = texto.replace(/\D/g, ''); 
    if (v.length > 8) v = v.substring(0, 8); 
    if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{1,4}).*/, '$1/$2/$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1/$2');
    return v;
  };

  // Converte de DD/MM/AAAA para AAAA-MM-DD
  const converterParaBanco = (dataBR: string) => {
    const partes = dataBR.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return null;
  };

  // Converte de AAAA-MM-DD para DD/MM/AAAA (para a tela de edição)
  const converterParaTela = (dataBD: string) => {
    if (!dataBD) return '';
    const partes = dataBD.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataBD;
  };

  const abrirModalNovo = () => {
    setEditandoColaboradorId(null);
    setNome('');
    setDataAdmissao('');
    setSetor('');
    setModalVisivel(true);
  };

  const iniciarEdicao = (item: any) => {
    setEditandoColaboradorId(item.id);
    setNome(item.nome);
    setDataAdmissao(converterParaTela(item.data_admissao));
    setSetor(item.setor);
    setModalVisivel(true);
  };

  const salvarColaborador = async () => {
    if (!nome || !dataAdmissao || !setor) {
      return Alert.alert("Aviso", "Preencha todos os campos!");
    }
    if (dataAdmissao.length !== 10) {
      return Alert.alert("Aviso", "Data de admissão incompleta!");
    }

    setSalvando(true);
    const dataFormatada = converterParaBanco(dataAdmissao);

    const payload = {
      nome: nome.trim().toUpperCase(),
      setor: setor,
      data_admissao: dataFormatada
    };

    let error;

    if (editandoColaboradorId) {
      // ATUALIZAR
      const { error: errUpdate } = await supabase.from('colaboradores').update(payload).eq('id', editandoColaboradorId);
      error = errUpdate;
    } else {
      // INSERIR
      const { error: errInsert } = await supabase.from('colaboradores').insert([payload]);
      error = errInsert;
    }

    setSalvando(false);
    
    if (error) {
      Alert.alert("Erro", "Falha ao salvar: " + error.message);
    } else {
      Alert.alert("Sucesso", editandoColaboradorId ? "Colaborador atualizado!" : "Colaborador cadastrado na equipe!");
      setModalVisivel(false);
      carregarDadosBase(); // Recarrega a lista e a mochila
    }
  };

  const excluirColaborador = (id: number, nomeColab: string) => {
    Alert.alert('Excluir', `Deseja realmente apagar o colaborador "${nomeColab}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim, Apagar', style: 'destructive', onPress: async () => {
          setCarregando(true);
          const { error } = await supabase.from('colaboradores').delete().eq('id', id);
          if (error) {
            Alert.alert("Erro", "Não foi possível excluir: " + error.message);
            setCarregando(false);
          } else {
            carregarDadosBase();
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Equipe 🧑‍🌾</Text>
        <Text style={styles.subtitle}>Total: {colaboradores.length} colaboradores ativos</Text>
      </View>

      <TouchableOpacity style={styles.btnNovo} onPress={abrirModalNovo}>
        <Text style={styles.btnNovoTexto}>➕ CADASTRAR FUNCIONÁRIO</Text>
      </TouchableOpacity>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {colaboradores.length === 0 ? (
            <Text style={styles.textoVazio}>Nenhum funcionário cadastrado.</Text>
          ) : (
            colaboradores.map((item) => (
              <View key={item.id} style={styles.cardColab}>
                <View style={styles.infoColab}>
                  <Text style={styles.nomeColab}>{item.nome}</Text>
                  <View style={styles.linhaDetalhe}>
                    <Text style={styles.detalheBadge}>🛠️ {item.setor || 'Não definido'}</Text>
                    <Text style={styles.detalheData}>
                      📅 Admissão: {item.data_admissao ? new Date(item.data_admissao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '--/--/----'}
                    </Text>
                  </View>
                </View>
                
                {/* BOTÕES DE AÇÃO: EDITAR E EXCLUIR */}
                <View style={styles.boxAcoes}>
                  <TouchableOpacity style={styles.btnAcao} onPress={() => iniciarEdicao(item)}>
                    <Text style={styles.iconeAcao}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnAcao} onPress={() => excluirColaborador(item.id, item.nome)}>
                    <Text style={styles.iconeAcao}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <Modal visible={modalVisivel} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editandoColaboradorId ? '✏️ Editar Colaborador' : 'Novo Colaborador'}</Text>

            <Text style={styles.label}>Nome Completo:</Text>
            <TextInput 
              style={styles.input} 
              value={nome} 
              onChangeText={setNome} 
              placeholder="Ex: JOÃO DA SILVA"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Setor de Trabalho:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={setor} onValueChange={setSetor}>
                <Picker.Item label="Selecione o setor..." value="" />
                {listaSetores.map((s, index) => (
                   <Picker.Item key={index} label={s.nome} value={s.nome} />
                ))}
              </Picker>
            </View>
            {listaSetores.length === 0 && (
               <Text style={{fontSize: 10, color: '#E74C3C', marginTop: 5}}>Nenhum setor cadastrado. Vá no Painel Admin para criar setores.</Text>
            )}

            <Text style={styles.label}>Data de Admissão:</Text>
            <TextInput 
              style={styles.input} 
              value={dataAdmissao} 
              onChangeText={(text) => setDataAdmissao(aplicarMascaraData(text))} 
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisivel(false)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSalvar} onPress={salvarColaborador} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSalvarTexto}>{editandoColaboradorId ? 'Atualizar' : 'Salvar'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { marginTop: 50, marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D' },
  
  btnNovo: { backgroundColor: '#27AE60', marginHorizontal: 20, padding: 15, borderRadius: 8, alignItems: 'center', elevation: 2 },
  btnNovoTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  lista: { padding: 20, paddingBottom: 100 },
  textoVazio: { textAlign: 'center', color: '#95A5A6', marginTop: 30 },
  
  cardColab: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#E0E6ED', elevation: 1 },
  infoColab: { flex: 1, justifyContent: 'center' },
  nomeColab: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50', marginBottom: 8 },
  linhaDetalhe: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10 },
  detalheBadge: { backgroundColor: '#EBF5FB', color: '#2980B9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 11, fontWeight: 'bold' },
  detalheData: { fontSize: 11, color: '#7F8C8D' },

  boxAcoes: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#F0F3F4' },
  btnAcao: { padding: 8 },
  iconeAcao: { fontSize: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 20, textAlign: 'center' },
  
  label: { fontSize: 13, fontWeight: 'bold', color: '#34495E', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  pickerContainer: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, backgroundColor: '#F9F9F9' },
  
  modalBotoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  btnCancelar: { flex: 1, backgroundColor: '#ECF0F1', padding: 15, borderRadius: 8, alignItems: 'center', marginRight: 10 },
  btnCancelarTexto: { color: '#7F8C8D', fontWeight: 'bold' },
  btnSalvar: { flex: 1, backgroundColor: '#3498DB', padding: 15, borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  btnSalvarTexto: { color: '#FFF', fontWeight: 'bold' }
});