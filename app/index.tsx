import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../src/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState(''); // Usado apenas no cadastro
  const [carregando, setCarregando] = useState(false);
  const [modoLogin, setModoLogin] = useState(true); // true = Login | false = Cadastro

  // Verifica se já tem alguém logado quando abre o app
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)'); 
      }
    });
  }, []);

  const fazerLogin = async () => {
    if (!email || !senha) return Alert.alert('Aviso', 'Preencha e-mail e senha!');
    
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      Alert.alert('Erro no Login', 'E-mail ou senha incorretos.');
    } else {
      router.replace('/(tabs)');
    }
  };

  const fazerCadastro = async () => {
    if (!nome || !email || !senha) return Alert.alert('Aviso', 'Preencha todos os campos!');
    if (senha.length < 6) return Alert.alert('Aviso', 'A senha deve ter no mínimo 6 caracteres.');
    
    setCarregando(true);
    
    // 1. Cria a conta no cofre do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (authError) {
      setCarregando(false);
      return Alert.alert('Erro no Cadastro', authError.message);
    }

    // 2. Salva o seu perfil como ADMINISTRADOR automaticamente
    if (authData.user) {
      const { error: profileError } = await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome: nome,
        email: email,
        cargo: 'Administrador' // Garante acesso total para você
      }]);

      setCarregando(false);

      if (profileError) {
        Alert.alert('Erro ao salvar Perfil', profileError.message);
      } else {
        Alert.alert('✅ Bem-vindo!', 'Conta de Administrador criada com sucesso!');
        router.replace('/(tabs)');
      }
    } else {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>Brekaz Produção </Text>
        <Text style={styles.subText}>Sistema de Gestão Agrícola</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.tituloCard}>
          {modoLogin ? 'Acesso ao Sistema' : 'Criar Conta Mestra'}
        </Text>

        {!modoLogin && (
          <>
            <Text style={styles.label}>Seu Nome:</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: Matheus Arruda" 
              value={nome}
              onChangeText={setNome}
            />
          </>
        )}

        <Text style={styles.label}>E-mail:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Digite seu e-mail" 
          keyboardType="email-address" 
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="********" 
          secureTextEntry 
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={modoLogin ? fazerLogin : fazerCadastro} 
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {modoLogin ? 'ENTRAR NO SISTEMA' : 'CADASTRAR E ENTRAR'}
            </Text>
          )}
        </TouchableOpacity>

        {/* BOTÃO PARA ALTERNAR ENTRE LOGIN E CADASTRO */}
        <TouchableOpacity 
          style={styles.btnAlternar} 
          onPress={() => setModoLogin(!modoLogin)}
        >
          <Text style={styles.btnAlternarTexto}>
            {modoLogin ? 'Primeiro acesso? Crie sua conta de Admin' : 'Já tem conta? Faça Login aqui'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2C3E50', justifyContent: 'center', padding: 20 },
  logoBox: { alignItems: 'center', marginBottom: 30 },
  logoText: { fontSize: 36, fontWeight: 'bold', color: '#27AE60' },
  subText: { fontSize: 16, color: '#BDC3C7', marginTop: 5 },
  card: { backgroundColor: '#FFF', padding: 25, borderRadius: 15, elevation: 10 },
  tituloCard: { fontSize: 20, fontWeight: 'bold', color: '#2980B9', textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#ECF0F1', paddingBottom: 10 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#34495E', marginBottom: 8, marginTop: 5 },
  input: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#F8FAFC', marginBottom: 10 },
  button: { backgroundColor: '#27AE60', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  btnAlternar: { marginTop: 20, alignItems: 'center', padding: 10 },
  btnAlternarTexto: { color: '#3498DB', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' }
});