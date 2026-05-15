import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function MapaScreen() {
  const [dadosAgrupados, setDadosAgrupados] = useState<any>({});
  const [totalGeralArvores, setTotalGeralArvores] = useState(0);
  const [carregando, setCarregando] = useState(true);
  
  const [isOffline, setIsOffline] = useState(false);
  const [listaServicos, setListaServicos] = useState<any[]>([]);

  // 👉 NOVO: Estado para saber se o usuário pode ou não editar a fazenda
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    verificarPerfil();
    carregarMapa();
  }, []);

  const verificarPerfil = async () => {
    try {
      const perfilSalvo = await AsyncStorage.getItem('@perfil_offline');
      if (perfilSalvo) {
        const perfil = JSON.parse(perfilSalvo);
        const cargoLimpo = perfil.cargo ? perfil.cargo.trim().toLowerCase() : '';
        
        // Apenas Administrador e Supervisor podem editar o mapa
        if (cargoLimpo === 'administrador' || cargoLimpo === 'supervisor') {
          setPodeEditar(true);
        } else {
          setPodeEditar(false);
        }
      }
    } catch (e) {
      console.log("Erro ao carregar perfil no mapa");
      setPodeEditar(false);
    }
  };

  const processarDadosMapa = (data: any[]) => {
    let somaGeral = 0;
    const agrupamento: any = {};

    data.forEach((item) => {
      const qtd = item.total_pes || 0;
      somaGeral += qtd;

      if (!agrupamento[item.fazenda]) agrupamento[item.fazenda] = { total: 0, quadras: {} };
      agrupamento[item.fazenda].total += qtd;

      if (!agrupamento[item.fazenda].quadras[item.quadra]) agrupamento[item.fazenda].quadras[item.quadra] = { total: 0, ramais: [] };
      agrupamento[item.fazenda].quadras[item.quadra].total += qtd;

      agrupamento[item.fazenda].quadras[item.quadra].ramais.push({
        id: item.id, 
        ramal: item.ramal,
        total: qtd,
        servico: item.servico_permitido || 'Não Definido'
      });
    });

    setTotalGeralArvores(somaGeral);
    setDadosAgrupados(agrupamento);
  };

  const carregarMapa = async () => {
    setCarregando(true);
    
    try {
      const { data: servs, error: errServs } = await supabase.from('servicos').select('*').order('nome');
      if (errServs) throw new Error("Falha na rede");
      if (servs) {
        setListaServicos(servs);
        await AsyncStorage.setItem('@mochila_servicos', JSON.stringify(servs));
      }

      const { data, error } = await supabase.from('mapa_fazendas').select('*').order('fazenda').order('quadra').order('ramal');
      if (error) throw new Error("Falha na rede");
      
      if (data) {
        await AsyncStorage.setItem('@mochila_mapa', JSON.stringify(data));
        processarDadosMapa(data);
      }
      
      setIsOffline(false); 

    } catch (error) {
      setIsOffline(true);
      
      const servsOffline = await AsyncStorage.getItem('@mochila_servicos');
      if (servsOffline) setListaServicos(JSON.parse(servsOffline));

      const mapaOffline = await AsyncStorage.getItem('@mochila_mapa');
      if (mapaOffline) {
        processarDadosMapa(JSON.parse(mapaOffline));
      }
    }
    
    setCarregando(false);
  };

  const confirmarAtualizacao = (id: number, campo: string, valorAntigo: any, valorNovo: any, nomeAmigavel: string) => {
    if (valorAntigo === valorNovo) return; 
    
    if (isOffline) {
      Alert.alert("⚠️ Sem Internet", "Não é possível alterar a estrutura da fazenda no modo offline. Conecte-se para editar.");
      return;
    }

    Alert.alert(
      "⚠️ Atenção",
      `Tem certeza que deseja alterar ${nomeAmigavel} para "${valorNovo}"?`,
      [
        { text: "Cancelar", style: "cancel", onPress: () => carregarMapa() },
        { text: "Sim, Alterar", onPress: () => atualizarConfigRamal(id, campo, valorNovo) }
      ]
    );
  };

  const atualizarConfigRamal = async (id: number, campo: string, valor: any) => {
    setCarregando(true);
    const { error } = await supabase.from('mapa_fazendas').update({ [campo]: valor }).eq('id', id);
    if (error) {
      Alert.alert("Erro", "Falha ao atualizar o dado.");
      carregarMapa();
    } else {
      carregarMapa(); 
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>⚠️ MODO OFFLINE ATIVADO - Apenas visualização.</Text>
        </View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Visão Geral 🌳</Text>
          <Text style={styles.subtitle}>Contagem Estruturada das Fazendas</Text>
        </View>

        <View style={styles.placarCard}>
          <Text style={styles.placarTexto}>Total Geral Cadastrado</Text>
          <Text style={styles.placarNumero}>{totalGeralArvores.toLocaleString('pt-BR')}</Text>
        </View>

        <TouchableOpacity style={styles.btnAtualizar} onPress={carregarMapa}>
          <Text style={styles.btnAtualizarTexto}>↻ Atualizar Contagem</Text>
        </TouchableOpacity>

        {carregando ? (
          <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 30}} />
        ) : (
          <View style={styles.listaContainer}>
            {Object.keys(dadosAgrupados).map((nomeFazenda) => {
              const fazenda = dadosAgrupados[nomeFazenda];
              return (
                <View key={nomeFazenda} style={styles.fazendaCard}>
                  <View style={styles.fazendaHeader}>
                    <Text style={styles.fazendaTitulo}>🏡 Fazenda {nomeFazenda}</Text>
                    <Text style={styles.fazendaTotal}>{fazenda.total.toLocaleString('pt-BR')} pés</Text>
                  </View>

                  {Object.keys(fazenda.quadras).map((nomeQuadra) => {
                    const quadra = fazenda.quadras[nomeQuadra];
                    return (
                      <View key={nomeQuadra} style={styles.quadraContainer}>
                        <View style={styles.quadraHeader}>
                          <Text style={styles.quadraTitulo}>📍 Quadra {nomeQuadra}</Text>
                          <Text style={styles.quadraTotal}>{quadra.total.toLocaleString('pt-BR')} pés</Text>
                        </View>

                        <View style={styles.ramalContainer}>
                          {quadra.ramais.map((r: any, idx: number) => (
                            <View key={r.id || idx} style={styles.ramalItem}>
                              
                              <View style={{ flex: 1.5, paddingRight: 10 }}>
                                <Text style={styles.ramalTexto}>↳ Ramal {r.ramal}</Text>
                                
                                <Text style={styles.miniLabel}>Serviço Vinculado:</Text>
                                
                                <View style={[styles.miniPickerContainer, !podeEditar && styles.pickerBloqueado]}>
                                  <Picker
                                    enabled={podeEditar} // 👉 BLOQUEIO: Só supervisor/admin pode clicar
                                    selectedValue={r.servico}
                                    onValueChange={(itemValue) => {
                                      if (itemValue !== r.servico && podeEditar) {
                                        confirmarAtualizacao(r.id, 'servico_permitido', r.servico, itemValue, 'o Serviço');
                                      }
                                    }}
                                    style={styles.miniPicker}
                                  >
                                    <Picker.Item label="Não Definido" value="Não Definido" />
                                    {listaServicos.map((s) => (
                                      <Picker.Item key={s.id} label={s.nome} value={s.nome} />
                                    ))}
                                  </Picker>
                                </View>
                              </View>

                              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                <Text style={styles.miniLabel}>Qtd Pés (Editar):</Text>
                                <TextInput 
                                  editable={podeEditar} // 👉 BLOQUEIO: Só supervisor/admin digita
                                  style={[styles.inputEditQtd, !podeEditar && styles.inputBloqueado]} 
                                  defaultValue={r.total.toString()}
                                  keyboardType="numeric"
                                  onEndEditing={(e) => {
                                    if (podeEditar) {
                                      const novoValor = parseInt(e.nativeEvent.text) || 0;
                                      confirmarAtualizacao(r.id, 'total_pes', r.total, novoValor, 'a Quantidade de Pés');
                                    }
                                  }}
                                />
                              </View>

                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  offlineBadge: { backgroundColor: '#E74C3C', padding: 8, alignItems: 'center', justifyContent: 'center' },
  offlineText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  placarCard: { backgroundColor: '#27AE60', padding: 25, borderRadius: 15, alignItems: 'center', marginBottom: 15 },
  placarTexto: { color: '#D5F5E3', fontSize: 16, fontWeight: 'bold' },
  placarNumero: { color: '#FFFFFF', fontSize: 45, fontWeight: '900', marginVertical: 5 },
  btnAtualizar: { backgroundColor: '#E0E6ED', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 25 },
  btnAtualizarTexto: { color: '#34495E', fontWeight: 'bold' },
  listaContainer: { paddingBottom: 20 },
  fazendaCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#E0E6ED' },
  fazendaHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#2C3E50', paddingBottom: 10, marginBottom: 10 },
  fazendaTitulo: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50' },
  fazendaTotal: { fontSize: 18, fontWeight: 'bold', color: '#27AE60' },
  quadraContainer: { marginLeft: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#F39C12', paddingLeft: 10 },
  quadraHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6 },
  quadraTitulo: { fontSize: 16, fontWeight: 'bold', color: '#34495E' },
  quadraTotal: { fontSize: 16, fontWeight: 'bold', color: '#D35400' },
  ramalContainer: { marginTop: 5, marginLeft: 15 },
  ramalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F4', alignItems: 'center' },
  ramalTexto: { fontSize: 15, color: '#2C3E50', fontWeight: 'bold' },
  
  miniLabel: { fontSize: 11, color: '#7F8C8D', marginTop: 4, fontWeight: 'bold' },
  
  miniPickerContainer: { backgroundColor: '#D4E6F1', borderRadius: 6, marginTop: 4, height: 50, justifyContent: 'center', overflow: 'hidden' },
  pickerBloqueado: { backgroundColor: '#EAECEE', opacity: 0.8 }, 
  miniPicker: { height: 50, color: '#2980B9', width: '100%', fontWeight: 'bold' },

  inputEditQtd: { backgroundColor: '#EAEDED', color: '#2C3E50', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, marginTop: 4, fontSize: 14, fontWeight: 'bold', textAlign: 'center', minWidth: 70 },
  inputBloqueado: { backgroundColor: '#EAECEE', color: '#95A5A6', fontStyle: 'italic' } 
});