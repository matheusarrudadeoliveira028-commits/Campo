import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function EquipesScreen() {
  const [fiscais, setFiscais] = useState<any[]>([]);
  const [fiscalSelecionado, setFiscalSelecionado] = useState('');
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    // Puxa quem é Fiscal, Supervisor, Encarregado OU Administrador (para você poder testar)
    const { data: fiscaisData } = await supabase
      .from('perfis')
      .select('id, nome')
      .in('cargo', ['Fiscal de Campo', 'Supervisor', 'Encarregado', 'Administrador'])
      .order('nome');
      
    if (fiscaisData) setFiscais(fiscaisData);

    // Puxa todos os colaboradores
    const { data: colabData } = await supabase
      .from('colaboradores')
      .select('id, nome, fiscal_id')
      .order('nome');
      
    if (colabData) setColaboradores(colabData);
    setCarregando(false);
  };

  // Função para vincular ou desvincular o peão do fiscal
  const alternarVinculo = async (colabId: string, fiscalAtualId: string | null) => {
    if (!fiscalSelecionado) {
      return Alert.alert('Aviso', 'Primeiro selecione um Fiscal no topo da tela!');
    }

    // Se ele já for desse fiscal, vamos desvincular (colocar null). Se não, vinculamos ao fiscal selecionado.
    const novoFiscalId = fiscalAtualId === fiscalSelecionado ? null : fiscalSelecionado;

    setSalvando(true);
    const { error } = await supabase
      .from('colaboradores')
      .update({ fiscal_id: novoFiscalId })
      .eq('id', colabId);

    if (error) {
      // AQUI ESTÁ A LUPA! Vai mostrar o erro exato na tela e no terminal:
      console.log("ERRO AO SALVAR:", error); 
      Alert.alert('Erro no Banco de Dados', error.message);
    } else {
      // Atualiza a lista na tela sem precisar recarregar o banco todo
      setColaboradores(colaboradores.map(c => 
        c.id === colabId ? { ...c, fiscal_id: novoFiscalId } : c
      ));
    }
    setSalvando(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Montar Equipes 👥</Text>
        <Text style={styles.subtitle}>Vincule os funcionários aos fiscais</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>1. Selecione o Fiscal Líder:</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={fiscalSelecionado} onValueChange={setFiscalSelecionado}>
            <Picker.Item label="Escolha um Fiscal..." value="" />
            {fiscais.map(f => (
              <Picker.Item key={f.id} label={f.nome} value={f.id} />
            ))}
          </Picker>
        </View>
      </View>

      {fiscalSelecionado ? (
        <ScrollView style={styles.listaContainer} contentContainerStyle={{ paddingBottom: 50 }}>
          <Text style={styles.label}>2. Selecione a equipe dele:</Text>
          
          {carregando || salvando ? <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 20}} /> : null}

          {colaboradores.map((colab) => {
            const isNaMinhaEquipe = colab.fiscal_id === fiscalSelecionado;
            const isEmOutraEquipe = colab.fiscal_id && colab.fiscal_id !== fiscalSelecionado;

            return (
              <TouchableOpacity 
                key={colab.id} 
                style={[
                  styles.colabRow, 
                  isNaMinhaEquipe && styles.colabRowAtivo,
                  isEmOutraEquipe && styles.colabRowOcupado
                ]}
                onPress={() => alternarVinculo(colab.id, colab.fiscal_id)}
                disabled={salvando}
              >
                <View>
                  <Text style={[styles.colabNome, isNaMinhaEquipe && styles.textoAtivo]}>{colab.nome}</Text>
                  {isEmOutraEquipe && <Text style={styles.textoOcupado}>⚠️ Já está em outra equipe</Text>}
                </View>
                
                <View style={[styles.checkbox, isNaMinhaEquipe && styles.checkboxAtivo]}>
                  {isNaMinhaEquipe && <Text style={styles.checkIcon}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.avisoBox}>
          <Text style={styles.avisoTexto}>👆 Selecione um fiscal acima para ver e montar a equipe dele.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7', padding: 20 },
  header: { marginTop: 10, marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 5, marginBottom: 15 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#34495E', marginBottom: 10 },
  pickerContainer: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  listaContainer: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 5 },
  
  colabRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#E0E6ED', marginBottom: 10, backgroundColor: '#F8FAFC' },
  colabRowAtivo: { borderColor: '#27AE60', backgroundColor: '#E8F8F5' },
  colabRowOcupado: { opacity: 0.6, backgroundColor: '#EAEDED' },
  
  colabNome: { fontSize: 16, fontWeight: 'bold', color: '#34495E' },
  textoAtivo: { color: '#1E8449' },
  textoOcupado: { fontSize: 12, color: '#E67E22', marginTop: 3 },
  
  checkbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#BDC3C7', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  checkboxAtivo: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  checkIcon: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  avisoBox: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  avisoTexto: { fontSize: 16, color: '#34495E', textAlign: 'center', paddingHorizontal: 20 }
});