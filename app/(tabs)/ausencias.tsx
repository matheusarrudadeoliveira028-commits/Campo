import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function AusenciasScreen() {
  const [colaborador, setColaborador] = useState('');
  const [tipoAusencia, setTipoAusencia] = useState('Falta');
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Carrega a lista de colaboradores quando a tela abre
  useEffect(() => {
    carregarColaboradores();
  }, []);

  const carregarColaboradores = async () => {
    setCarregandoDados(true);
    try {
      const { data, error } = await supabase.from('colaboradores').select('*').order('nome');
      if (error) Alert.alert("Erro", error.message);
      else if (data) setListaColaboradores(data);
    } catch (e: any) {
      Alert.alert("Erro de Conexão", e.message);
    }
    setCarregandoDados(false);
  };

  const salvarAusencia = async () => {
    if (!colaborador || !tipoAusencia) {
      return Alert.alert("Aviso", "Selecione o colaborador e o tipo de ausência!");
    }

    setSalvando(true);

    // O Segredo: Enviamos os campos de localização vazios e o dinheiro zerado!
    const { error } = await supabase.from('diarios_campo').insert([{ 
      colaborador: colaborador, 
      servico: tipoAusencia, // Vai gravar "Falta" ou "Atestado"
      fazenda: '-', 
      quadra: '-', 
      ramal: '-', 
      quantidade: 0,
      valor_unitario: 0,
      valor_total: 0
    }]);

    setSalvando(false);

    if (error) {
      Alert.alert("Erro ao salvar", error.message);
    } else {
      Alert.alert("✅ Sucesso!", `${tipoAusencia} registrada para ${colaborador} com sucesso!`);
      // Limpa para o próximo
      setColaborador('');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Controle de Ponto 📅</Text>
        <Text style={styles.subtitle}>Lançamento de Faltas e Atestados</Text>
      </View>

      <View style={styles.card}>
        {carregandoDados ? (
          <View style={{alignItems: 'center', marginVertical: 20}}>
            <ActivityIndicator size="large" color="#E74C3C" />
            <Text style={{marginTop: 10, color: '#7F8C8D'}}>Carregando equipe...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Colaborador:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                <Picker.Item label="Selecione quem faltou..." value="" />
                {listaColaboradores.map((item) => (
                  <Picker.Item key={item.id} label={item.nome} value={item.nome} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Tipo de Ocorrência:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={tipoAusencia} onValueChange={setTipoAusencia} style={styles.picker}>
                <Picker.Item label="Falta Injustificada" value="Falta" />
                <Picker.Item label="Atestado Médico" value="Atestado" />
                <Picker.Item label="Aviso Prévio / Folga" value="Folga" />
              </Picker>
            </View>

            {/* CAIXA DE AVISO VISUAL */}
            <View style={[styles.avisoBox, tipoAusencia === 'Falta' ? styles.avisoFalta : styles.avisoAtestado]}>
              <Text style={styles.avisoTexto}>
                {tipoAusencia === 'Falta' 
                  ? "⚠️ O colaborador não receberá valor por este dia (R$ 0,00)." 
                  : "ℹ️ Ausência justificada. O valor lançado será R$ 0,00."}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.button, salvando ? styles.buttonDisabled : null, tipoAusencia === 'Falta' ? styles.btnFalta : styles.btnAtestado]} 
              onPress={salvarAusencia} 
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Registrar {tipoAusencia}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonAtualizar} onPress={carregarColaboradores}>
              <Text style={styles.buttonAtualizarText}>↻ Recarregar Equipe</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <View style={{height: 50}} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  
  avisoBox: { padding: 15, borderRadius: 8, marginTop: 20, borderWidth: 1 },
  avisoFalta: { backgroundColor: '#FDEDEC', borderColor: '#E74C3C' },
  avisoAtestado: { backgroundColor: '#EBF5FB', borderColor: '#3498DB' },
  avisoTexto: { color: '#2C3E50', fontSize: 14, textAlign: 'center', fontWeight: '500' },

  button: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  btnFalta: { backgroundColor: '#E74C3C' },
  btnAtestado: { backgroundColor: '#3498DB' },
  buttonDisabled: { backgroundColor: '#95A5A6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  buttonAtualizar: { backgroundColor: '#E0E6ED', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  buttonAtualizarText: { color: '#34495E', fontSize: 14, fontWeight: 'bold' },
});