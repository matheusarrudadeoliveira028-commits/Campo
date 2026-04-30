import { Picker } from '@react-native-picker/picker';
import { decode } from 'base64-arraybuffer'; // Para converter a imagem pro Supabase
import * as ImagePicker from 'expo-image-picker'; // IMPORTANDO A CÂMERA
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function HomeScreen() {
  const [colaborador, setColaborador] = useState('');
  const [servico, setServico] = useState('');
  const [servicoSelecionadoCompleto, setServicoSelecionadoCompleto] = useState<any>(null);
  
  const [fazenda, setFazenda] = useState('');
  const [quadra, setQuadra] = useState('');
  const [ramal, setRamal] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotalCalculado, setValorTotalCalculado] = useState(0);
  
  // ESTADOS DA FOTO
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [tirandoFoto, setTirandoFoto] = useState(false);
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [mapaCompleto, setMapaCompleto] = useState<any[]>([]);
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<string[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<string[]>([]);
  const [ramaisDisponiveis, setRamaisDisponiveis] = useState<any[]>([]);
  const [limitePes, setLimitePes] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  useEffect(() => { carregarDadosBase(); }, []);

  const carregarDadosBase = async () => {
    setCarregandoDados(true);
    const { data: colabs } = await supabase.from('colaboradores').select('*').order('nome');
    if (colabs) setListaColaboradores(colabs);
    const { data: servs } = await supabase.from('servicos').select('*').order('nome');
    if (servs) setListaServicos(servs);
    const { data: mapa } = await supabase.from('mapa_fazendas').select('*');
    if (mapa) {
      setMapaCompleto(mapa);
      setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
    }
    setCarregandoDados(false);
  };

  useEffect(() => {
    setQuadra(''); setRamal(''); setLimitePes(null);
    if (fazenda) setQuadrasDisponiveis([...new Set(mapaCompleto.filter(m => m.fazenda === fazenda).map(m => m.quadra))] as string[]);
    else setQuadrasDisponiveis([]);
  }, [fazenda]);

  useEffect(() => {
    setRamal(''); setLimitePes(null);
    if (quadra) setRamaisDisponiveis(mapaCompleto.filter(m => m.fazenda === fazenda && m.quadra === quadra));
    else setRamaisDisponiveis([]);
  }, [quadra]);

  useEffect(() => {
    if (ramal) {
      const ramalSelecionado = ramaisDisponiveis.find(r => r.ramal === ramal);
      if (ramalSelecionado) setLimitePes(ramalSelecionado.total_pes);
    } else setLimitePes(null);
  }, [ramal]);

  useEffect(() => {
    if (servicoSelecionadoCompleto && quantidade) {
      const qtdNum = parseInt(quantidade) || 0;
      let valorUnitario = servicoSelecionadoCompleto.preco_base || 0;
      if (servicoSelecionadoCompleto.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;
      setValorTotalCalculado(qtdNum * valorUnitario);
    } else setValorTotalCalculado(0);
  }, [servicoSelecionadoCompleto, quantidade]);

  const handleMudancaQuantidade = (texto: string) => {
    const valorDigitado = parseInt(texto) || 0;
    if (limitePes !== null && valorDigitado > limitePes) {
      alert(`⚠️ Bloqueado: Este ramal tem um limite máximo de ${limitePes} pés!`);
      setQuantidade(limitePes.toString());
    } else setQuantidade(texto);
  };

  // FUNÇÃO DE ABRIR A CÂMERA
  const abrirCamera = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (permissao.status === 'granted') {
      setTirandoFoto(true);
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Deixa cortar a foto quadrada
        aspect: [4, 3],
        quality: 0.3, // Reduz qualidade pra salvar rápido no 4G da roça
        base64: true, // Transforma a foto em código pra subir pro Supabase
      });

      if (!resultado.canceled) {
        setFotoUri(resultado.assets[0].uri);
        setFotoBase64(resultado.assets[0].base64 || null);
      }
      setTirandoFoto(false);
    } else {
      Alert.alert("Permissão negada", "O aplicativo precisa da câmera para a assinatura visual.");
    }
  };

  const salvarLancamento = async () => {
    if (!colaborador || !servico || !fazenda || !quadra || !ramal || !quantidade) {
      return alert("Por favor, preencha todos os campos obrigatórios!");
    }
    
    // Trava de segurança: Exige a foto!
    if (!fotoBase64) {
      return alert("⚠️ É obrigatório tirar a foto do colaborador para registrar o lançamento!");
    }

    setSalvando(true);

    let urlFotoSalva = null;

    // 1. SOBE A FOTO PRO STORAGE DO SUPABASE
    try {
      const nomeArquivo = `${colaborador.replace(/\s+/g, '')}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('assinaturas')
        .upload(nomeArquivo, decode(fotoBase64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Pega o link público da foto que acabou de subir
      const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(nomeArquivo);
      urlFotoSalva = urlData.publicUrl;
      
    } catch (e) {
      setSalvando(false);
      return alert("Erro ao salvar a foto. Tente novamente.");
    }

    // 2. SALVA O LANÇAMENTO COM O LINK DA FOTO
    let valorUnitario = servicoSelecionadoCompleto.preco_base || 0;
    if (servicoSelecionadoCompleto.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;

    const { error } = await supabase.from('diarios_campo').insert([{ 
      colaborador, servico, fazenda, quadra, ramal, 
      quantidade: parseInt(quantidade),
      valor_unitario: valorUnitario,
      valor_total: valorTotalCalculado,
      foto_assinatura: urlFotoSalva // <--- SALVANDO O LINK DA FOTO NO BANCO!
    }]);

    setSalvando(false);
    if (error) alert("Erro ao salvar: " + error.message);
    else {
      alert("✅ Lançamento e Foto salvos com sucesso!");
      setRamal(''); setQuantidade(''); setValorTotalCalculado(0); 
      setFotoUri(null); setFotoBase64(null); // Limpa a foto da tela
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Axoryn Campo 🚜</Text>
        <Text style={styles.subtitle}>Lançamento de Produção</Text>
      </View>

      <View style={styles.card}>
        {carregandoDados ? (
          <ActivityIndicator size="large" color="#27AE60" style={{marginVertical: 20}}/>
        ) : (
          <>
            <Text style={styles.label}>Colaborador:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                <Picker.Item label="Selecione..." value="" />
                {listaColaboradores.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
              </Picker>
            </View>

            <Text style={styles.label}>Serviço:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={servico} onValueChange={(itemValue) => {
                  setServico(itemValue);
                  setServicoSelecionadoCompleto(listaServicos.find(s => s.nome === itemValue) || null);
                }} style={styles.picker}>
                <Picker.Item label="Selecione..." value="" />
                {listaServicos.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
              </Picker>
            </View>

            <Text style={styles.label}>Fazenda:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={fazenda} onValueChange={setFazenda} style={styles.picker}>
                <Picker.Item label="Selecione..." value="" />
                {fazendasDisponiveis.map((faz, idx) => (<Picker.Item key={idx} label={faz} value={faz} />))}
              </Picker>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Quadra:</Text>
                <View style={[styles.pickerContainer, !fazenda ? styles.disabled : null]}>
                  <Picker enabled={!!fazenda} selectedValue={quadra} onValueChange={setQuadra} style={styles.picker}>
                    <Picker.Item label="..." value="" />
                    {quadrasDisponiveis.map((q, idx) => (<Picker.Item key={idx} label={q} value={q} />))}
                  </Picker>
                </View>
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Ramal:</Text>
                <View style={[styles.pickerContainer, !quadra ? styles.disabled : null]}>
                  <Picker enabled={!!quadra} selectedValue={ramal} onValueChange={setRamal} style={styles.picker}>
                    <Picker.Item label="..." value="" />
                    {ramaisDisponiveis.map((r, idx) => (<Picker.Item key={idx} label={r.ramal} value={r.ramal} />))}
                  </Picker>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Quantidade (Qtd):</Text>
            <TextInput 
              style={[styles.input, !ramal ? styles.disabledInput : null]} 
              placeholder="Ex: 1000" keyboardType="numeric" value={quantidade} onChangeText={handleMudancaQuantidade} editable={!!ramal} 
            />

            {valorTotalCalculado > 0 && (
              <Text style={styles.valorTexto}>Gerado: R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}</Text>
            )}

            {/* SEÇÃO DA CÂMERA */}
            <View style={styles.cameraBox}>
              <Text style={styles.label}>Assinatura Visual (Foto do Funcionário):</Text>
              
              {fotoUri ? (
                <View style={{alignItems: 'center'}}>
                  <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
                  <TouchableOpacity onPress={abrirCamera} style={styles.btnTirarFotoNova}>
                    <Text style={styles.btnTirarFotoTexto}>📸 Tirar Outra Foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={abrirCamera} style={styles.btnCamera}>
                  <Text style={styles.btnCameraTexto}>📸 Abrir Câmera</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.button, salvando ? styles.buttonDisabled : null]} onPress={salvarLancamento} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>💾 Salvar Produção</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
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
  disabled: { backgroundColor: '#EAECEE', opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8FAFC', color: '#2C3E50', height: 50 },
  disabledInput: { backgroundColor: '#EAECEE', color: '#999' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  valorTexto: { color: '#1E8449', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 15 },
  
  cameraBox: { marginTop: 20, padding: 15, backgroundColor: '#F9E79F', borderRadius: 10, borderWidth: 1, borderColor: '#F1C40F' },
  btnCamera: { backgroundColor: '#D4AC0D', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnCameraTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  fotoPreview: { width: 150, height: 150, borderRadius: 10, marginTop: 10, borderWidth: 2, borderColor: '#2C3E50' },
  btnTirarFotoNova: { marginTop: 10 },
  btnTirarFotoTexto: { color: '#D4AC0D', fontWeight: 'bold', textDecorationLine: 'underline' },

  button: { backgroundColor: '#27AE60', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  buttonDisabled: { backgroundColor: '#95A5A6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});