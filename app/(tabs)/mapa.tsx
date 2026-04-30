import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function MapaScreen() {
  const [dadosAgrupados, setDadosAgrupados] = useState<any>({});
  const [totalGeralArvores, setTotalGeralArvores] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarMapa();
  }, []);

  const carregarMapa = async () => {
    setCarregando(true);
    const { data } = await supabase.from('mapa_fazendas').select('*').order('fazenda').order('quadra').order('ramal');
    
    if (data) {
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
          ramal: item.ramal,
          total: qtd,
          servico: item.servico_permitido || 'Não Definido' // PUXANDO O SERVIÇO
        });
      });

      setTotalGeralArvores(somaGeral);
      setDadosAgrupados(agrupamento);
    }
    setCarregando(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Visão Geral 🌳</Text>
        <Text style={styles.subtitle}>Contagem Estruturada das Fazendas</Text>
      </View>

      <View style={styles.placarCard}>
        <Text style={styles.placarTexto}>Total Geral Cadastrado</Text>
        <Text style={styles.placarNumero}>{totalGeralArvores.toLocaleString('pt-BR')}</Text>
      </View>

      <TouchableOpacity style={styles.btnAtualizar} onPress={carregarMapa}><Text style={styles.btnAtualizarTexto}>↻ Atualizar Contagem</Text></TouchableOpacity>

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
                          <View key={idx} style={styles.ramalItem}>
                            <View>
                              <Text style={styles.ramalTexto}>↳ Ramal {r.ramal}</Text>
                              {/* ETIQUETA DO SERVIÇO AQUI: */}
                              <View style={styles.badgeServico}>
                                <Text style={styles.badgeTexto}>{r.servico}</Text>
                              </View>
                            </View>
                            <Text style={styles.ramalTotal}>{r.total.toLocaleString('pt-BR')} pés</Text>
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
      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
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
  ramalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F2F4F4', alignItems: 'center' },
  ramalTexto: { fontSize: 14, color: '#2C3E50', fontWeight: 'bold' },
  ramalTotal: { fontSize: 14, fontWeight: '600', color: '#7F8C8D' },
  
  // ESTILO DA NOVA ETIQUETA DO SERVIÇO
  badgeServico: { backgroundColor: '#D4E6F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  badgeTexto: { color: '#2980B9', fontSize: 11, fontWeight: 'bold' }
});