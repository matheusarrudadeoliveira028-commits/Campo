import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function ConfiguracoesScreen() {
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [configId, setConfigId] = useState<number | null>(null);
  
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    setCarregando(true);
    // Puxa a única linha que criamos no banco de dados
    const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
    
    if (data) {
      setHoraInicio(data.hora_inicio);
      setHoraFim(data.hora_fim);
      setConfigId(data.id);
    } else if (error) {
      Alert.alert("Aviso", "Ainda não existem configurações salvas no banco.");
    }
    setCarregando(false);
  };

  // MÁSCARA DE HORA (Ex: 06:00)
  const aplicarMascaraHora = (texto: string) => {
    let v = texto.replace(/\D/g, ''); // Remove o que não for número
    if (v.length > 4) v = v.substring(0, 4); // Limita a 4 números
    if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1:$2'); // Coloca os dois pontos
    return v;
  };

  const handleSalvar = async () => {
    if (horaInicio.length !== 5 || horaFim.length !== 5) {
      return Alert.alert("Aviso", "Preencha os horários no formato HH:MM (ex: 06:00).");
    }

    setSalvando(true);

    try {
      if (configId) {
        // Atualiza a regra existente
        const { error } = await supabase
          .from('configuracoes')
          .update({ hora_inicio: horaInicio, hora_fim: horaFim, updated_at: new Date().toISOString() })
          .eq('id', configId);
        
        if (error) throw error;
      } else {
        // Prevenção de segurança (caso o comando SQL não tenha rodado direito)
        const { error } = await supabase
          .from('configuracoes')
          .insert([{ hora_inicio: horaInicio, hora_fim: horaFim }]);
        
        if (error) throw error;
      }

      Alert.alert("✅ Sucesso", "Janela de expediente atualizada para toda a equipe!");
      carregarConfiguracoes();
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // === NOVO: BOTÃO DE LOGOUT MOVIDO PARA CÁ ===
  const fazerLogout = () => {
    Alert.alert("Sair do Sistema", "Deseja realmente sair da sua conta no aplicativo?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sim, Sair", 
        style: 'destructive',
        onPress: () => { 
          // 1. Limpa a mochila do usuário no fundo (Sem await)
          AsyncStorage.removeItem('@perfil_offline');
          
          // 2. Destrói os tokens do Supabase no fundo (Sem await)
          AsyncStorage.getAllKeys().then(chaves => {
            const chavesSupabase = chaves.filter(c => c.includes('supabase.auth.token'));
            if (chavesSupabase.length > 0) {
              AsyncStorage.multiRemove(chavesSupabase);
            }
          });

          // 3. Avisa o Supabase pra deslogar, ignora o resultado se der erro sem internet
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});

          // 4. Joga pra tela de login na mesma hora!
          setTimeout(() => {
            router.replace('/');
          }, 100);
        } 
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações ⚙️</Text>
        <Text style={styles.subtitle}>Regras gerais de operação da fazenda</Text>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#27AE60" style={{ marginTop: 50 }} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.formTitle}>⏱️ Expediente Permitido</Text>
          <Text style={styles.descricao}>
            Defina abaixo o horário em que o aplicativo permitirá o lançamento de produção. Fora dessa janela, o sistema irá bloquear registros automaticamente para evitar fraudes ou horas extras não autorizadas.
          </Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Hora de Início:</Text>
              <TextInput 
                style={styles.input} 
                value={horaInicio} 
                onChangeText={(t) => setHoraInicio(aplicarMascaraHora(t))} 
                placeholder="06:00"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Hora de Fim:</Text>
              <TextInput 
                style={styles.input} 
                value={horaFim} 
                onChangeText={(t) => setHoraFim(aplicarMascaraHora(t))} 
                placeholder="18:00"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSalvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>💾 ATUALIZAR EXPEDIENTE</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* SESSÃO DE LOGOUT */}
      <View style={styles.sessaoSair}>
        <Text style={styles.avisoSair}>Se precisar trocar de usuário ou atualizar o sistema por completo, saia da sua conta abaixo.</Text>
        <TouchableOpacity style={styles.btnSair} onPress={fazerLogout}>
          <Text style={styles.btnSairTexto}>🚪 SAIR DA CONTA</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 30, marginTop: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#E74C3C', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 10, borderColor: '#ECF0F1' },
  descricao: { fontSize: 13, color: '#7F8C8D', marginBottom: 25, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 20, backgroundColor: '#F8FAFC', height: 55, textAlign: 'center', fontWeight: 'bold', color: '#2C3E50', letterSpacing: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  button: { backgroundColor: '#2C3E50', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  // ESTILOS DO BOTÃO DE SAIR
  sessaoSair: { marginTop: 40, alignItems: 'center', borderTopWidth: 1, borderColor: '#E0E6ED', paddingTop: 30 },
  avisoSair: { fontSize: 12, color: '#95A5A6', textAlign: 'center', marginBottom: 15, paddingHorizontal: 20 },
  btnSair: { backgroundColor: '#E74C3C', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 8, elevation: 3, width: '100%', alignItems: 'center' },
  btnSairTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});