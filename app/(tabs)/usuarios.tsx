import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function UsuariosScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('Fiscal de Campo');
  const [salvando, setSalvando] = useState(false);

  const cadastrarUsuario = async () => {
    if (!nome || !email || !senha || !cargo) {
      return Alert.alert('Aviso', 'Preencha todos os campos!');
    }
    if (senha.length < 6) {
      return Alert.alert('Aviso', 'A senha deve ter pelo menos 6 caracteres.');
    }

    setSalvando(true);

    // 1. Cria o usuário na autenticação do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (authError) {
      setSalvando(false);
      return Alert.alert('Erro ao Criar Conta', authError.message);
    }

    // 2. Salva o Perfil e o Cargo na nossa tabela customizada
    if (authData.user) {
      const { error: profileError } = await supabase.from('perfis').insert([{
        id: authData.user.id,
        nome,
        email,
        cargo
      }]);

      if (profileError) {
        Alert.alert('Erro ao salvar Perfil', profileError.message);
      } else {
        Alert.alert('✅ Sucesso!', `${cargo} cadastrado com sucesso!`);
        setNome(''); setEmail(''); setSenha(''); setCargo('Fiscal de Campo');
      }
    }
    setSalvando(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Acessos 🔐</Text>
        <Text style={styles.subtitle}>Criar login para a equipe</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nome Completo:</Text>
        <TextInput style={styles.input} placeholder="Ex: João Silva" value={nome} onChangeText={setNome} />

        <Text style={styles.label}>Nível de Acesso (Cargo):</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={cargo} onValueChange={setCargo}>
            <Picker.Item label="Fiscal de Campo (Lança Produção)" value="Fiscal de Campo" />
            <Picker.Item label="Encarregado (Supervisiona Equipe)" value="Encarregado" />
            <Picker.Item label="Supervisor (Gere Fazenda)" value="Supervisor" />
            <Picker.Item label="Administrador (Acesso Total)" value="Administrador" />
          </Picker>
        </View>

        <Text style={styles.label}>E-mail (Login):</Text>
        <TextInput style={styles.input} placeholder="joao@fazenda.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

        <Text style={styles.label}>Senha Provisória:</Text>
        <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" secureTextEntry value={senha} onChangeText={setSenha} />

        <TouchableOpacity style={styles.button} onPress={cadastrarUsuario} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>CADASTRAR USUÁRIO</Text>}
        </TouchableOpacity>

        <View style={styles.avisoBox}>
          <Text style={styles.avisoTexto}>
            ⚠️ Nota: Ao cadastrar um novo usuário pelo app, o Supabase fará o login automático na conta dele. Após criar a equipe, basta você relogar na sua conta Admin.
          </Text>
        </View>
      </View>
      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7', padding: 20 },
  header: { marginTop: 30, marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 5 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#34495E', marginBottom: 5, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#F8FAFC' },
  pickerContainer: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  button: { backgroundColor: '#2980B9', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  avisoBox: { marginTop: 25, backgroundColor: '#FEF9E7', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#F1C40F' },
  avisoTexto: { fontSize: 12, color: '#D35400', textAlign: 'justify' }
});