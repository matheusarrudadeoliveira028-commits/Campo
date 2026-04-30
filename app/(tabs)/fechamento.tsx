import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function FechamentoScreen() {
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('');
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  
  // DADOS
  const [dadosCompletosUsuario, setDadosCompletosUsuario] = useState<any[]>([]);
  const [extrato, setExtrato] = useState<any[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [buscandoExtrato, setBuscandoExtrato] = useState(false);

  // FILTROS DE DATA
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // TOTAIS
  const [totalGanho, setTotalGanho] = useState(0);
  const [totalPes, setTotalPes] = useState(0);

  // ESTADOS DO MODAL DE EDIÇÃO
  const [modalEdicaoVisivel, setModalEdicaoVisivel] = useState(false);
  const [itemEditando, setItemEditando] = useState<any>(null);
  const [editQuantidade, setEditQuantidade] = useState('');
  const [editDiasAtestado, setEditDiasAtestado] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    carregarEquipe();
  }, []);

  useEffect(() => {
    if (colaboradorSelecionado) {
      setDataInicio('');
      setDataFim('');
      buscarExtratoColaborador();
    } else {
      setDadosCompletosUsuario([]);
      setExtrato([]);
      setTotalGanho(0);
      setTotalPes(0);
    }
  }, [colaboradorSelecionado]);

  const carregarEquipe = async () => {
    setCarregandoDados(true);
    const { data } = await supabase.from('colaboradores').select('*').order('nome');
    if (data) setListaColaboradores(data);
    setCarregandoDados(false);
  };

  const buscarExtratoColaborador = async () => {
    setBuscandoExtrato(true);
    
    // SE FOR 'TODOS', BUSCA A FOLHA DA FAZENDA INTEIRA
    let query = supabase.from('diarios_campo').select('*').order('data', { ascending: false });
    
    if (colaboradorSelecionado !== 'TODOS') {
      query = query.eq('colaborador', colaboradorSelecionado);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert("Erro", "Falha ao buscar os dados.");
    } else if (data) {
      setDadosCompletosUsuario(data);
      aplicarFiltrosEAtualizarTotais(data, '', ''); 
    }
    setBuscandoExtrato(false);
  };

  const formatarDataInput = (texto: string) => {
    let v = texto.replace(/\D/g, '');
    if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
    if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
    return v;
  };

  const aplicarFiltrosEAtualizarTotais = (dadosBase: any[], inicio: string, fim: string) => {
    let filtrados = dadosBase;

    const converterParaISO = (dataBR: string) => {
      const p = dataBR.split('/');
      if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
      return null;
    };

    const isoInicio = converterParaISO(inicio);
    const isoFim = converterParaISO(fim);

    if (isoInicio) {
      filtrados = filtrados.filter(item => {
        const dataItem = (item.data || item.created_at).split('T')[0];
        return dataItem >= isoInicio;
      });
    }

    if (isoFim) {
      filtrados = filtrados.filter(item => {
        const dataItem = (item.data || item.created_at).split('T')[0];
        return dataItem <= isoFim;
      });
    }

    setExtrato(filtrados);
    
    let somaDinheiro = 0;
    let somaPes = 0;
    filtrados.forEach(item => {
      somaDinheiro += item.valor_total || 0;
      somaPes += item.quantidade || 0;
    });
    
    setTotalGanho(somaDinheiro);
    setTotalPes(somaPes);
  };

  const acionarFiltroManual = () => {
    aplicarFiltrosEAtualizarTotais(dadosCompletosUsuario, dataInicio, dataFim);
  };

  const confirmarExclusao = (id: number, servico: string, dataLancamento: string) => {
    Alert.alert(
      "⚠️ Excluir Lançamento",
      `Deseja apagar o registro de "${servico}" do dia ${new Date(dataLancamento).toLocaleDateString('pt-BR')}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, Excluir", style: "destructive", onPress: () => deletarLancamento(id) }
      ]
    );
  };

  const deletarLancamento = async (id: number) => {
    const { error } = await supabase.from('diarios_campo').delete().eq('id', id);
    if (!error) {
      Alert.alert("✅ Excluído", "Lançamento removido.");
      buscarExtratoColaborador(); 
    }
  };

  // FUNÇÕES DE EDIÇÃO
  const abrirEdicao = (item: any) => {
    if (item.servico === 'Falta') {
      return Alert.alert("Aviso", "Faltas não possuem valores para editar. Se lançou errado, exclua o registro.");
    }
    setItemEditando(item);
    setEditQuantidade(item.quantidade ? item.quantidade.toString() : '0');
    setEditDiasAtestado(item.dias_atestado ? item.dias_atestado.toString() : '');
    setModalEdicaoVisivel(true);
  };

  const salvarEdicao = async () => {
    setSalvandoEdicao(true);
    let updates: any = {};

    if (itemEditando.servico === 'Atestado') {
      updates = { dias_atestado: parseInt(editDiasAtestado) || 0 };
    } else {
      const novaQtd = parseInt(editQuantidade) || 0;
      const novoTotalDinheiro = novaQtd * (itemEditando.valor_unitario || 0);
      updates = { quantidade: novaQtd, valor_total: novoTotalDinheiro };
    }

    const { error } = await supabase.from('diarios_campo').update(updates).eq('id', itemEditando.id);
    
    setSalvandoEdicao(false);
    if (error) {
      Alert.alert("Erro", "Falha ao editar.");
    } else {
      Alert.alert("✅ Atualizado", "O lançamento foi corrigido.");
      setModalEdicaoVisivel(false);
      buscarExtratoColaborador(); // Recarrega os dados corrigidos
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Folha de Pagamento 💰</Text>
        <Text style={styles.subtitle}>Conferência e Fechamento de Caixa</Text>
      </View>

      <View style={styles.filtroCard}>
        <Text style={styles.label}>Selecione a Visão:</Text>
        <View style={styles.pickerContainer}>
          {carregandoDados ? (
            <ActivityIndicator color="#34495E" style={{margin: 10}} />
          ) : (
            <Picker selectedValue={colaboradorSelecionado} onValueChange={setColaboradorSelecionado}>
              <Picker.Item label="Selecione um funcionário ou todos..." value="" />
              <Picker.Item label="🌟 TODOS OS COLABORADORES (TOTAL GERAL)" value="TODOS" />
              {listaColaboradores.map(c => <Picker.Item key={c.id} label={c.nome} value={c.nome} />)}
            </Picker>
          )}
        </View>

        {colaboradorSelecionado !== '' && (
          <View style={styles.blocoDatas}>
            <Text style={styles.labelData}>Filtrar por Período (Opcional):</Text>
            <View style={styles.row}>
              <View style={styles.colData}>
                <TextInput 
                  style={styles.inputData} 
                  placeholder="De: DD/MM/AAAA" 
                  placeholderTextColor="#95A5A6"
                  keyboardType="numeric"
                  value={dataInicio}
                  onChangeText={(t) => setDataInicio(formatarDataInput(t))}
                  maxLength={10}
                />
              </View>
              <View style={styles.colData}>
                <TextInput 
                  style={styles.inputData} 
                  placeholder="Até: DD/MM/AAAA" 
                  placeholderTextColor="#95A5A6"
                  keyboardType="numeric"
                  value={dataFim}
                  onChangeText={(t) => setDataFim(formatarDataInput(t))}
                  maxLength={10}
                />
              </View>
            </View>
            <TouchableOpacity style={styles.btnFiltrar} onPress={acionarFiltroManual}>
              <Text style={styles.btnFiltrarTexto}>🔍 APLICAR FILTRO E SOMAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {colaboradorSelecionado !== '' && (
        <>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoAvisoGlobal}>
              {colaboradorSelecionado === 'TODOS' ? 'VALOR TOTAL DA FAZENDA' : `RESUMO: ${colaboradorSelecionado.toUpperCase()}`}
            </Text>
            <View style={styles.resumoRow}>
              <View style={styles.resumoBox}>
                <Text style={styles.resumoTitulo}>Total Produzido</Text>
                <Text style={styles.resumoValorAzul}>{totalPes.toLocaleString('pt-BR')} pés</Text>
              </View>
              <View style={styles.resumoBox}>
                <Text style={styles.resumoTitulo}>Valor de Pagamento</Text>
                <Text style={styles.resumoValorVerde}>R$ {totalGanho.toFixed(2).replace('.', ',')}</Text>
              </View>
            </View>
            {(dataInicio || dataFim) && (
              <Text style={styles.avisoFiltroAtivo}>
                Mostrando resultados {dataInicio ? `de ${dataInicio}` : ''} {dataFim ? `até ${dataFim}` : ''}
              </Text>
            )}
          </View>

          <Text style={styles.listaTitulo}>Histórico de Lançamentos</Text>

          {buscandoExtrato ? (
            <ActivityIndicator size="large" color="#27AE60" style={{marginTop: 20}} />
          ) : extrato.length === 0 ? (
            <Text style={styles.vazioTexto}>Nenhum registro encontrado neste período.</Text>
          ) : (
            extrato.map((item) => {
              const isFalta = item.servico === 'Falta';
              const isAtestado = item.servico === 'Atestado';
              const dataExibicao = item.data ? new Date(item.data) : new Date(item.created_at);

              return (
                <View key={item.id} style={[styles.lancamentoCard, isFalta ? styles.cardFalta : isAtestado ? styles.cardAtestado : null]}>
                  
                  <View style={styles.lancamentoTopo}>
                    <Text style={styles.lancamentoData}>{dataExibicao.toLocaleDateString('pt-BR')} - {dataExibicao.toLocaleTimeString('pt-BR').slice(0,5)}</Text>
                    <Text style={[styles.lancamentoServico, isFalta ? {color: '#C0392B'} : isAtestado ? {color: '#2980B9'} : null]}>
                      {item.servico}
                    </Text>
                  </View>

                  {/* Mostra de quem é o lançamento se estiver na visão global */}
                  {colaboradorSelecionado === 'TODOS' && (
                    <Text style={styles.detalheTexto}>👤 Funcionário: {item.colaborador}</Text>
                  )}

                  {!isFalta && !isAtestado && (
                    <View style={styles.lancamentoDetalhes}>
                      <Text style={styles.detalheTexto}>📍 Fazenda: {item.fazenda} | Qd: {item.quadra} | Rm: {item.ramal}</Text>
                      <View style={styles.linhaValores}>
                        <Text style={styles.detalheQtd}>Qtd: {item.quantidade} pés</Text>
                        <Text style={styles.detalheValor}>+ R$ {item.valor_total.toFixed(2).replace('.', ',')}</Text>
                      </View>
                    </View>
                  )}

                  {isAtestado && (
                    <View style={styles.lancamentoDetalhes}>
                      <Text style={styles.detalheTexto}>🏥 Data: {item.data_atestado} | Duração: {item.dias_atestado} dias</Text>
                      <Text style={styles.detalheTexto}>🩺 CID: {item.cid_atestado}</Text>
                    </View>
                  )}

                  {/* BARRA DE AÇÕES: EDITAR E EXCLUIR */}
                  <View style={styles.acoesRow}>
                    <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEdicao(item)}>
                      <Text style={styles.btnEditarTexto}>✏️ Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnExcluir} onPress={() => confirmarExclusao(item.id, item.servico, item.data || item.created_at)}>
                      <Text style={styles.btnExcluirTexto}>🗑️ Excluir</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              );
            })
          )}
        </>
      )}

      {/* MODAL DE EDIÇÃO */}
      <Modal visible={modalEdicaoVisivel} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Lançamento</Text>
            
            {itemEditando?.servico === 'Atestado' ? (
              <>
                <Text style={styles.modalLabel}>Dias de Duração (Atestado):</Text>
                <TextInput style={styles.modalInput} keyboardType="numeric" value={editDiasAtestado} onChangeText={setEditDiasAtestado} />
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>Quantidade de Pés Produzidos:</Text>
                <TextInput style={styles.modalInput} keyboardType="numeric" value={editQuantidade} onChangeText={setEditQuantidade} />
                <Text style={styles.modalAviso}>O valor a receber será recalculado automaticamente com base na nova quantidade.</Text>
              </>
            )}

            <View style={styles.modalAcoes}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={() => setModalEdicaoVisivel(false)}>
                <Text style={styles.modalBtnTextoCancelar}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtnSalvar} onPress={salvarEdicao} disabled={salvandoEdicao}>
                {salvandoEdicao ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnTextoSalvar}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{height: 80}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7', padding: 20 },
  header: { marginTop: 30, marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D' },
  
  filtroCard: { backgroundColor: '#34495E', padding: 15, borderRadius: 12, marginBottom: 20 },
  label: { color: '#BDC3C7', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  pickerContainer: { backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden' },

  blocoDatas: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#465C70', paddingTop: 15 },
  labelData: { color: '#BDC3C7', fontSize: 12, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  colData: { width: '48%' },
  inputData: { backgroundColor: '#FFF', borderRadius: 6, padding: 10, fontSize: 14, color: '#2C3E50', textAlign: 'center', fontWeight: 'bold' },
  btnFiltrar: { backgroundColor: '#27AE60', padding: 12, borderRadius: 6, marginTop: 15, alignItems: 'center' },
  btnFiltrarTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  resumoCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 5, marginBottom: 25 },
  resumoAvisoGlobal: { textAlign: 'center', fontWeight: 'bold', color: '#34495E', marginBottom: 15, fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#ECF0F1', paddingBottom: 5 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoBox: { alignItems: 'center', width: '48%' },
  resumoTitulo: { fontSize: 12, color: '#7F8C8D', fontWeight: 'bold', textTransform: 'uppercase' },
  resumoValorAzul: { fontSize: 24, fontWeight: '900', color: '#2980B9', marginTop: 5 },
  resumoValorVerde: { fontSize: 24, fontWeight: '900', color: '#27AE60', marginTop: 5 },
  avisoFiltroAtivo: { textAlign: 'center', color: '#E67E22', fontWeight: 'bold', fontSize: 11, marginTop: 10 },

  listaTitulo: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, borderBottomWidth: 1, borderColor: '#D5DBDB', paddingBottom: 5 },
  vazioTexto: { textAlign: 'center', color: '#95A5A6', fontStyle: 'italic', marginTop: 20 },

  lancamentoCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: '#27AE60', elevation: 2 },
  cardFalta: { borderLeftColor: '#E74C3C', backgroundColor: '#FDEDEC' },
  cardAtestado: { borderLeftColor: '#3498DB', backgroundColor: '#EBF5FB' },
  
  lancamentoTopo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F4', paddingBottom: 5 },
  lancamentoData: { fontSize: 12, color: '#95A5A6', fontWeight: 'bold' },
  lancamentoServico: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50' },
  
  lancamentoDetalhes: { marginBottom: 10 },
  detalheTexto: { fontSize: 13, color: '#34495E', marginBottom: 3, fontWeight: 'bold' },
  linhaValores: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  detalheQtd: { fontSize: 14, fontWeight: 'bold', color: '#7F8C8D' },
  detalheValor: { fontSize: 16, fontWeight: '900', color: '#27AE60' },

  acoesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: '#ECF0F1', paddingTop: 10 },
  btnEditar: { backgroundColor: '#EAF2F8', padding: 8, borderRadius: 5, alignItems: 'center', width: '48%' },
  btnEditarTexto: { color: '#2980B9', fontSize: 12, fontWeight: 'bold' },
  btnExcluir: { backgroundColor: '#FADBD8', padding: 8, borderRadius: 5, alignItems: 'center', width: '48%' },
  btnExcluirTexto: { color: '#C0392B', fontSize: 12, fontWeight: 'bold' },

  // ESTILOS DO MODAL
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, textAlign: 'center' },
  modalLabel: { fontSize: 14, fontWeight: 'bold', color: '#34495E', marginBottom: 5 },
  modalInput: { borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 12, fontSize: 18, backgroundColor: '#F8FAFC', textAlign: 'center', marginBottom: 10 },
  modalAviso: { fontSize: 11, color: '#E67E22', fontStyle: 'italic', marginBottom: 20, textAlign: 'center' },
  modalAcoes: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancelar: { backgroundColor: '#95A5A6', padding: 15, borderRadius: 8, width: '48%', alignItems: 'center' },
  modalBtnTextoCancelar: { color: '#FFF', fontWeight: 'bold' },
  modalBtnSalvar: { backgroundColor: '#27AE60', padding: 15, borderRadius: 8, width: '48%', alignItems: 'center' },
  modalBtnTextoSalvar: { color: '#FFF', fontWeight: 'bold' }
});