import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function EquipesScreen() {
  const [fiscais, setFiscais] = useState<any[]>([]);
  const [todosColaboradores, setTodosColaboradores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fiscalSelecionado, setFiscalSelecionado] = useState<number | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    // Busca quem é Fiscal
    const { data: dataFiscais } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('cargo', 'Fiscal')
      .order('nome');

    // Busca todos os Colaboradores
    const { data: dataColabs } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('cargo', 'Colaborador')
      .order('nome');

    if (dataFiscais) setFiscais(dataFiscais);
    if (dataColabs) setTodosColaboradores(dataColabs);
    setCarregando(false);
  };

  const vincularAoFiscal = async (colaboradorId: number, novoFiscalId: any) => {
    const { error } = await supabase
      .from('colaboradores')
      .update({ fiscal_id: novoFiscalId === 'nenhum' ? null : novoFiscalId })
      .eq('id', colaboradorId);

    if (error) {
      Alert.alert("Erro", "Não foi possível atualizar a equipe.");
    } else {
      carregarDados(); // Recarrega a visão
    }
  };

  // Filtra a equipe para a visão de "Equipe por Equipe"
  const equipeAtual = todosColaboradores.filter(c => c.fiscal_id === fiscalSelecionado);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Equipes 👥</Text>
        <Text style={styles.subtitle}>Vincule colaboradores aos Fiscais</Text>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#2980B9" />
      ) : (
        <>
          {/* SELETOR DE VISÃO POR FISCAL */}
          <View style={styles.cardFiltro}>
            <Text style={styles.label}>Filtrar Visão por Fiscal:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={fiscalSelecionado}
                onValueChange={(item) => setFiscalSelecionado(item)}
              >
                <Picker.Item label="Ver todos os colaboradores..." value={null} />
                {fiscais.map(f => (
                  <Picker.Item key={f.id} label={`📂 Equipe: ${f.nome}`} value={f.id} />
                ))}
              </Picker>
            </View>
          </View>

          {/* LISTAGEM DE COLABORADORES */}
          <Text style={styles.sectionTitle}>
            {fiscalSelecionado ? `Membros da Equipe (${equipeAtual.length})` : "Todos os Colaboradores"}
          </Text>

          {(fiscalSelecionado ? equipeAtual : todosColaboradores).map((colab) => (
            <View key={colab.id} style={styles.colabCard}>
              <View>
                <Text style={styles.colabNome}>{colab.nome}</Text>
                <Text style={styles.colabStatus}>
                  {colab.fiscal_id 
                    ? `Responsável: ${fiscais.find(f => f.id === colab.fiscal_id)?.nome || 'Fiscal'}` 
                    : '⚠️ Sem fiscal vinculado'}
                </Text>
              </View>

              <View style={styles.vincularBox}>
                <Text style={styles.miniLabel}>Mudar Fiscal:</Text>
                <View style={styles.miniPicker}>
                  <Picker
                    selectedValue={colab.fiscal_id}
                    onValueChange={(valor) => vincularAoFiscal(colab.id, valor)}
                    style={{ height: 40 }}
                  >
                    <Picker.Item label="Nenhum" value="nenhum" />
                    {fiscais.map(f => (
                      <Picker.Item key={f.id} label={f.nome} value={f.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          ))}
          
          {fiscalSelecionado && equipeAtual.length === 0 && (
            <Text style={styles.vazio}>Nenhum colaborador nesta equipe ainda.</Text>
          )}
        </>
      )}
      <View style={{height: 80}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7', padding: 20 },
  header: { marginTop: 30, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D' },
  cardFiltro: { backgroundColor: '#34495E', padding: 15, borderRadius: 12, marginBottom: 25 },
  label: { color: '#BDC3C7', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  pickerContainer: { backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15 },
  colabCard: { 
    backgroundColor: '#FFF', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10, 
    elevation: 3,
    flexDirection: 'column'
  },
  colabNome: { fontSize: 18, fontWeight: 'bold', color: '#34495E' },
  colabStatus: { fontSize: 12, color: '#27AE60', marginTop: 2 },
  vincularBox: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#F2F4F4', paddingTop: 10 },
  miniLabel: { fontSize: 11, color: '#95A5A6', fontWeight: 'bold' },
  miniPicker: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 5, marginTop: 5, backgroundColor: '#FBFCFC' },
  vazio: { textAlign: 'center', marginTop: 20, color: '#95A5A6', fontStyle: 'italic' }
});