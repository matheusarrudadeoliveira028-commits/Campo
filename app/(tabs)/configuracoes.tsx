import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function ConfiguracoesScreen() {
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [configId, setConfigId] = useState<number | null>(null);
  
  const [permitirMapa, setPermitirMapa] = useState(true);
  const [permitirFinanceiro, setPermitirFinanceiro] = useState(false);
  const [permitirEquipe, setPermitirEquipe] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    verificarPerfil();
    carregarConfiguracoes();
  }, []);

  const verificarPerfil = async () => {
    try {
      const perfilSalvo = await AsyncStorage.getItem('@perfil_offline');
      if (perfilSalvo) {
        setIsAdmin(JSON.parse(perfilSalvo).cargo === 'Administrador');
      }
    } catch (e) {
      console.log("Erro ao carregar perfil");
    }
  };

  const carregarConfiguracoes = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (data) {
        setHoraInicio(data.hora_inicio);
        setHoraFim(data.hora_fim);
        setPermitirMapa(data.permitir_mapa ?? true);
        setPermitirFinanceiro(data.permitir_financeiro ?? false);
        setPermitirEquipe(data.permitir_equipe ?? false);
        setConfigId(data.id);
        
        await AsyncStorage.setItem('@config_global', JSON.stringify(data));
      }
    } catch (e) {
      console.log("Erro ao carregar configurações");
    }
    setCarregando(false);
  };

  const aplicarMascaraHora = (texto: string) => {
    let v = texto.replace(/\D/g, ''); 
    if (v.length > 4) v = v.substring(0, 4); 
    if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1:$2'); 
    return v;
  };

  const handleSalvar = async () => {
    if (horaInicio.length !== 5 || horaFim.length !== 5) {
      return Alert.alert("Aviso", "Preencha os horários no formato HH:MM.");
    }
    setSalvando(true);
    
    const dadosParaSalvar = {
      hora_inicio: horaInicio, 
      hora_fim: horaFim,
      permitir_mapa: permitirMapa,
      permitir_financeiro: permitirFinanceiro,
      permitir_equipe: permitirEquipe
    };

    try {
      if (configId) {
        await supabase.from('configuracoes').update(dadosParaSalvar).eq('id', configId);
      } else {
        await supabase.from('configuracoes').insert([dadosParaSalvar]);
      }
      
      await AsyncStorage.setItem('@config_global', JSON.stringify(dadosParaSalvar));
      Alert.alert("✅ Sucesso", "Configurações atualizadas!");
      carregarConfiguracoes();
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const fazerLogout = () => {
    Alert.alert("Encerrar Turno", "Deseja realmente sair do sistema?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sim, Sair", 
        style: 'destructive',
        onPress: async () => { 
          setSaindo(true); 
          try {
            const chaves = await AsyncStorage.getAllKeys();
            const chavesParaApagar = chaves.filter(c => 
              c.includes('supabase') || c === '@perfil_offline' || c === '@lancamentos_off'
            );
            if (chavesParaApagar.length > 0) await AsyncStorage.multiRemove(chavesParaApagar);
            await supabase.auth.signOut();
          } catch (error) {
            console.log("Erro ao sair");
          } finally {
            setSaindo(false);
            router.replace('/login'); 
          }
        } 
      }
    ]);
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent} // Estilo ajustado aqui
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Configurações ⚙️</Text>
        <Text style={styles.subtitle}>Gerenciamento da Fazenda</Text>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{ marginTop: 50 }} />
      ) : (
        <View style={styles.mainContent}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>⏱️ Expediente</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Início:</Text>
                <TextInput style={styles.input} value={horaInicio} onChangeText={(t) => setHoraInicio(aplicarMascaraHora(t))} placeholder="06:00" keyboardType="numeric" maxLength={5} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Fim:</Text>
                <TextInput style={styles.input} value={horaFim} onChangeText={(t) => setHoraFim(aplicarMascaraHora(t))} placeholder="18:00" keyboardType="numeric" maxLength={5} />
              </View>
            </View>
          </View>

          {isAdmin && (
            <View style={[styles.card, { marginTop: 15 }]}>
              <Text style={styles.formTitle}>🔒 Permissões dos Fiscais</Text>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Visualizar Mapa</Text>
                <Switch value={permitirMapa} onValueChange={setPermitirMapa} trackColor={{ false: '#BDC3C7', true: '#27AE60' }} />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ver Financeiro</Text>
                <Switch value={permitirFinanceiro} onValueChange={setPermitirFinanceiro} trackColor={{ false: '#BDC3C7', true: '#27AE60' }} />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Gerenciar Equipe</Text>
                <Switch value={permitirEquipe} onValueChange={setPermitirEquipe} trackColor={{ false: '#BDC3C7', true: '#27AE60' }} />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.buttonSave} onPress={handleSalvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>SALVAR ALTERAÇÕES</Text>}
          </TouchableOpacity>

          {/* SESSÃO DE LOGOUT DENTRO DO FLUXO DE SCROLL COM MARGEM EXTRA */}
          <View style={styles.logoutSection}>
            <View style={styles.divider} />
            <Text style={styles.logoutNote}>Deseja trocar de usuário?</Text>
            <TouchableOpacity style={styles.btnSair} onPress={fazerLogout} disabled={saindo}>
               {saindo ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSairTexto}>ENCERRAR TURNO</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 }, // Aumento do padding inferior para o scroll fluir
  header: { marginTop: 50, marginBottom: 25, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 15, color: '#7F8C8D' },
  mainContent: { width: '100%' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: '#E74C3C', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 8 },
  label: { fontSize: 13, color: '#34495E', marginBottom: 5, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 10, fontSize: 18, backgroundColor: '#F9FBFF', textAlign: 'center', color: '#2C3E50' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '47%' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  switchLabel: { fontSize: 14, color: '#2C3E50', fontWeight: '500' },
  buttonSave: { backgroundColor: '#2C3E50', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  
  // Estilos da Sessão de Sair Ajustados
  logoutSection: { marginTop: 40, paddingBottom: 20 },
  divider: { height: 1, backgroundColor: '#E0E6ED', width: '100%', marginBottom: 20 },
  logoutNote: { textAlign: 'center', color: '#95A5A6', fontSize: 12, marginBottom: 15 },
  btnSair: { backgroundColor: '#E74C3C', paddingVertical: 16, borderRadius: 8, alignItems: 'center', shadowColor: '#E74C3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  btnSairTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }
});