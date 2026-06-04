import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function GeradorDiarioScreen() {
  const [fiscalSelecionado, setFiscalSelecionado] = useState('');
  const [listaFiscais, setListaFiscais] = useState<any[]>([]);
  
  const [listaColaboradoresTotal, setListaColaboradoresTotal] = useState<any[]>([]);
  const [listaFiltrada, setListaFiltrada] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  // 👉 MÁGICA DA EQUIPE: Filtra e seleciona automaticamente quando o Fiscal muda
  useEffect(() => {
    if (fiscalSelecionado) {
      const equipe = listaColaboradoresTotal.filter(c => 
        c.encarregado === fiscalSelecionado || 
        c.equipe === fiscalSelecionado || 
        c.fiscal === fiscalSelecionado
      );
      
      const listaExibicao = equipe.length > 0 ? equipe : listaColaboradoresTotal;
      
      setListaFiltrada(listaExibicao);
      setSelecionados(equipe.length > 0 ? equipe.map(c => c.nome) : []); 
    } else {
      setListaFiltrada([]);
      setSelecionados([]);
    }
  }, [fiscalSelecionado, listaColaboradoresTotal]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const { data: colabs, error: errColab } = await supabase.from('colaboradores').select('*').order('nome');
      if (errColab) throw errColab;

      const { data: todosPerfis, error: errPerfis } = await supabase.from('perfis').select('*').order('nome');
      if (errPerfis) throw errPerfis;

      // 👉 O RADAR: Puxa qualquer perfil que tenha a palavra "fiscal" ou "encarregado" no cargo
      const fiscais = todosPerfis.filter(p => {
        const cargoLimpo = p.cargo ? p.cargo.trim().toLowerCase() : '';
        return cargoLimpo.includes('fiscal') || cargoLimpo.includes('encarregado');
      });

      if (colabs && fiscais) {
        setListaColaboradoresTotal(colabs);
        setListaFiscais(fiscais);
        await AsyncStorage.setItem('@mochila_colab_diario', JSON.stringify(colabs));
        await AsyncStorage.setItem('@mochila_fiscais_diario', JSON.stringify(fiscais));
      } else {
        throw new Error("Dados vazios");
      }
    } catch (error) {
      console.log("Buscando dados do diário na mochila offline...");
      
      const salvosColabs = await AsyncStorage.getItem('@mochila_colab_diario') || await AsyncStorage.getItem('@mochila_colaboradores');
      const salvosFiscais = await AsyncStorage.getItem('@mochila_fiscais_diario');
      
      if (salvosColabs) setListaColaboradoresTotal(JSON.parse(salvosColabs));
      if (salvosFiscais) setListaFiscais(JSON.parse(salvosFiscais));
    } finally {
      setCarregando(false);
    }
  };

  const alternarSelecao = (nome: string) => {
    if (selecionados.includes(nome)) {
      setSelecionados(selecionados.filter(n => n !== nome));
    } else {
      setSelecionados([...selecionados, nome]);
    }
  };

  const selecionarTodos = () => {
    if (selecionados.length === listaFiltrada.length) {
      setSelecionados([]); 
    } else {
      setSelecionados(listaFiltrada.map(c => c.nome)); 
    }
  };

  const gerarECompartilharPDF = async () => {
    if (!fiscalSelecionado) return Alert.alert("Aviso", "Selecione o Fiscal!");
    if (selecionados.length === 0) return Alert.alert("Aviso", "Selecione ao menos um colaborador da equipe!");

    setGerandoPDF(true);

    let linhasHtml = '';
    
    selecionados.forEach((nome) => {
      linhasHtml += `
        <tr class="blank-row">
          <td rowspan="3" class="func-cell">${nome}</td>
          <td></td><td></td><td></td><td></td><td></td>
        </tr>
        <tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>
        <tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { margin: 20px; }
            body { font-family: Arial, sans-serif; padding: 10px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; text-align: center; }
            .header-table th { background-color: #EAECEE; width: 15%; padding: 6px; font-size: 14px; }
            .header-table td { text-align: left; padding-left: 10px; font-weight: bold; font-size: 14px; }
            .main-table th { background-color: #EAECEE; padding: 8px; font-size: 13px; }
            .main-table td { padding: 4px; }
            .func-cell { vertical-align: middle; font-weight: bold; font-size: 12px; width: 25%; text-transform: uppercase; }
            .blank-row td { height: 30px; }
            tr { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <th>Fiscal</th>
              <td colspan="2">${fiscalSelecionado.toUpperCase()}</td>
              <th style="width: 10%">Data</th>
              <td style="width: 20%">___/___/20__</td>
            </tr>
            <tr>
              <th>Fazendas</th>
              <td colspan="4"></td>
            </tr>
          </table>

          <table class="main-table">
            <tr>
              <th>Funcionários</th>
              <th>Serviços</th>
              <th>Faz</th>
              <th>Talhão</th>
              <th>Ramal</th>
              <th>Total</th>
            </tr>
            ${linhasHtml}
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false
      });

      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Diário Reserva 📄</Text>
        <Text style={styles.subtitle}>Gere folhas de papel para a equipe</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Selecione o Fiscal / Encarregado:</Text>
        {carregando ? (
          <ActivityIndicator color="#2980B9" style={{ marginVertical: 10 }} />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker selectedValue={fiscalSelecionado} onValueChange={setFiscalSelecionado} style={styles.picker}>
              <Picker.Item label="Escolha o Fiscal..." value="" />
              {listaFiscais.length > 0 ? (
                listaFiscais.map((f) => (
                  <Picker.Item key={f.id} label={f.nome} value={f.nome} />
                ))
              ) : (
                <Picker.Item label="Nenhum fiscal encontrado..." value="" />
              )}
            </Picker>
          </View>
        )}
      </View>

      {fiscalSelecionado !== '' && (
        <View style={styles.cardLista}>
          <View style={styles.linhaTituloLista}>
            <Text style={styles.label}>Equipe Selecionada:</Text>
            {listaFiltrada.length > 0 && (
              <TouchableOpacity onPress={selecionarTodos}>
                <Text style={styles.textoSelecionarTodos}>
                  {selecionados.length === listaFiltrada.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {listaFiltrada.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#7F8C8D', textAlign: 'center', fontWeight: 'bold' }}>
                Nenhum colaborador encontrado para gerar folha.
              </Text>
            </View>
          ) : (
            listaFiltrada.map((colab) => (
              <TouchableOpacity 
                key={colab.id} 
                style={[styles.itemLista, selecionados.includes(colab.nome) && styles.itemSelecionado]}
                onPress={() => alternarSelecao(colab.nome)}
              >
                <Text style={[styles.nomeLista, selecionados.includes(colab.nome) && styles.nomeSelecionado]}>
                  👷 {colab.nome}
                </Text>
                <Switch
                  trackColor={{ false: "#BDC3C7", true: "#27AE60" }}
                  thumbColor="#FFF"
                  value={selecionados.includes(colab.nome)}
                  onValueChange={() => alternarSelecao(colab.nome)}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {selecionados.length > 0 && (
        <TouchableOpacity 
          style={styles.btnGerar} 
          onPress={gerarECompartilharPDF} 
          disabled={gerandoPDF}
        >
          {gerandoPDF ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnGerarTexto}>🖨️ GERAR DIÁRIO EM PDF</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, elevation: 3, marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#34495E', marginBottom: 10 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  cardLista: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 12, elevation: 3, marginBottom: 20 },
  linhaTituloLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  textoSelecionarTodos: { color: '#2980B9', fontWeight: 'bold', fontSize: 13, textDecorationLine: 'underline' },
  itemLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ECF0F1' },
  itemSelecionado: { backgroundColor: '#F4FDFC', borderRadius: 8, paddingHorizontal: 5 },
  nomeLista: { fontSize: 15, color: '#2C3E50', flex: 1 },
  nomeSelecionado: { fontWeight: 'bold', color: '#1E8449' },
  btnGerar: { backgroundColor: '#E67E22', padding: 18, borderRadius: 10, alignItems: 'center', elevation: 5, shadowColor: '#E67E22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  btnGerarTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});