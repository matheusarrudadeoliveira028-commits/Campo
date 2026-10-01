import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function ConfiguracoesScreen() {
  const [saindo, setSaindo] = useState(false);
  const [perfilLogado, setPerfilLogado] = useState<any>(null);

  // 🟢 ESTADOS DO PAINEL MASTER (SÓ APARECE PARA contato@brekaztech.com.br)
  const [emailAlvo, setEmailAlvo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const EMAIL_MASTER = 'contato@brekaztech.com.br';

  useEffect(() => {
    carregarUsuarioLogado();
  }, []);

  const carregarUsuarioLogado = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setPerfilLogado(user);
      } else {
        const perfilSalvoStr = await AsyncStorage.getItem('@perfil_offline');
        if (perfilSalvoStr) setPerfilLogado(JSON.parse(perfilSalvoStr));
      }
    } catch (e) {
      console.log('Erro ao buscar perfil logado nas configurações.');
    }
  };

  // 🟢 FUNÇÃO MASTER: Forçar alteração de senha
  const forcarAlteracaoSenha = async () => {
    if (!emailAlvo || novaSenha.length < 6) {
      return Alert.alert("Aviso", "Preencha o e-mail do colaborador e uma nova senha (mín. 6 caracteres).");
    }

    setAlterandoSenha(true);

    try {
      // Chama a Edge Function no Supabase para alterar a senha usando privilégios de Admin
      const { data, error } = await supabase.functions.invoke('master-reset-password', {
        body: { email: emailAlvo.trim().toLowerCase(), novaSenha: novaSenha }
      });

      if (error) throw error;

      Alert.alert("✅ Sucesso Mestre!", `A senha de ${emailAlvo} foi atualizada com sucesso sem envio de e-mail.`);
      setEmailAlvo('');
      setNovaSenha('');
    } catch (error: any) {
      Alert.alert("Erro", "Falha ao alterar senha. Verifique se a Edge Function está configurada no Supabase.\n\n" + error.message);
    } finally {
      setAlterandoSenha(false);
    }
  };

  // 👇 TRAVA DE SEGURANÇA MANTIDA E ATIVADA
  const fazerLogout = async () => {
    try {
      const pendentesStr = await AsyncStorage.getItem('@lancamentos_off');
      if (pendentesStr) {
        const pendentes = JSON.parse(pendentesStr);
        if (pendentes.length > 0) {
          return Alert.alert(
            "⚠️ Ação Bloqueada", 
            `Você tem ${pendentes.length} lançamentos offline guardados no celular!\n\nConecte-se à internet e aperte "ENVIAR TUDO" na tela de Início antes de encerrar seu turno, ou você perderá essa produção.`
          );
        }
      }
    } catch (e) {
      console.log("Erro ao checar mochila");
    }

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
              c.includes('supabase') || c === '@perfil_offline' || c === '@lancamentos_off' || c === '@ausencias_off'
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
      contentContainerStyle={styles.scrollContent} 
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Configurações ⚙️</Text>
        <Text style={styles.subtitle}>Gerenciamento do Aplicativo</Text>
      </View>

      <View style={styles.mainContent}>
        
        {/* 🟢 PAINEL MASTER (FICA INVISÍVEL PARA OS OUTROS) */}
        {perfilLogado?.email === EMAIL_MASTER && (
          <View style={styles.masterCard}>
            <Text style={styles.masterTitle}>🛠️ Painel Mestre (Brekaz)</Text>
            <Text style={styles.masterSubtitle}>Altere a senha de qualquer conta sem confirmação.</Text>

            <Text style={styles.label}>E-mail do Colaborador:</Text>
            <TextInput 
              style={styles.input} 
              placeholder="exemplo@fazenda.com" 
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailAlvo} 
              onChangeText={setEmailAlvo} 
            />

            <Text style={styles.label}>Nova Senha Direta:</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Digite a nova senha" 
              secureTextEntry
              value={novaSenha} 
              onChangeText={setNovaSenha} 
            />

            <TouchableOpacity style={styles.btnMaster} onPress={forcarAlteracaoSenha} disabled={alterandoSenha}>
              {alterandoSenha ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnMasterTexto}>FORÇAR NOVA SENHA</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* SESSÃO DE LOGOUT */}
        <View style={styles.logoutSection}>
          <Text style={styles.logoutNote}>Seu turno acabou? Lembre-se de sincronizar seus dados antes de sair.
          Agradecemos o uso do Sistema</Text>
          <TouchableOpacity style={styles.btnSair} onPress={fazerLogout} disabled={saindo}>
             {saindo ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSairTexto}>ENCERRAR TURNO (SAIR)</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 }, 
  header: { marginTop: 50, marginBottom: 25, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 15, color: '#7F8C8D' },
  mainContent: { width: '100%' },
  
  // Estilos do Painel Master
  masterCard: { backgroundColor: '#2C3E50', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 5 },
  masterTitle: { color: '#F1C40F', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  masterSubtitle: { color: '#BDC3C7', fontSize: 13, marginBottom: 15 },
  label: { color: '#ECF0F1', fontSize: 13, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, fontSize: 15, color: '#2C3E50' },
  btnMaster: { backgroundColor: '#F1C40F', padding: 15, borderRadius: 8, marginTop: 20, alignItems: 'center' },
  btnMasterTexto: { color: '#2C3E50', fontWeight: 'bold', fontSize: 15 },

  logoutSection: { marginTop: 20, paddingBottom: 20 },
  logoutNote: { textAlign: 'center', color: '#95A5A6', fontSize: 12, marginBottom: 15 },
  btnSair: { backgroundColor: '#E74C3C', paddingVertical: 16, borderRadius: 8, alignItems: 'center', shadowColor: '#E74C3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  btnSairTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }
});