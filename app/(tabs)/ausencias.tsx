import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase';

export default function AusenciasScreen() {
  const [abaAtiva, setAbaAtiva] = useState<'cadastrar' | 'gerenciar'>('cadastrar');

  // ================= ESTADOS PARA CADASTRO =================
  const [colaborador, setColaborador] = useState('');
  const [tipoAusencia, setTipoAusencia] = useState('Atestado'); 
  
  // ESTADOS PARA O ATESTADO (CADASTRO)
  const [dataAtestado, setDataAtestado] = useState('');
  const [diasAtestado, setDiasAtestado] = useState('');
  const [cidAtestado, setCidAtestado] = useState('');
  
  // ESTADOS PARA O ABONAMENTO (CADASTRO)
  const [dataAbono, setDataAbono] = useState('');
  const [motivoAbono, setMotivoAbono] = useState('');
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // ================= ESTADOS PARA GESTÃO & FILTROS =================
  const [ausenciasCadastradas, setAusenciasCadastradas] = useState<any[]>([]);
  const [carregandoAusencias, setCarregandoAusencias] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // ================= ESTADOS DO MODAL DE EDIÇÃO =================
  const [modalEdicaoVisivel, setModalEdicaoVisivel] = useState(false);
  const [editId, setEditId] = useState('');
  const [editColaborador, setEditColaborador] = useState('');
  const [editTipoAusencia, setEditTipoAusencia] = useState('Atestado');
  const [editData, setEditData] = useState('');
  const [editDias, setEditDias] = useState('');
  const [editCid, setEditCid] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    carregarColaboradores();
    
    // Sugere o mês atual preenchido automaticamente para os filtros
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(primeiroDia.toLocaleDateString('pt-BR'));
    setDataFim(ultimoDia.toLocaleDateString('pt-BR'));
  }, []);

  useEffect(() => {
    if (abaAtiva === 'gerenciar') {
      carregarAusenciasGerais();
    }
  }, [abaAtiva]);

  const carregarColaboradores = async () => {
    setCarregandoDados(true);
    try {
      const { data, error } = await supabase.from('colaboradores').select('*').order('nome');
      if (error) Alert.alert("Erro", error.message);
      else if (data) setListaColaboradores(data);
    } catch (e: any) {
      Alert.alert("Erro de Conexão", e.message);
    }
    setCarregandoDados(false);
  };

  const carregarAusenciasGerais = async () => {
    setCarregandoAusencias(true);
    try {
      let query = supabase
        .from('diarios_campo')
        .select('*')
        .or('servico.ilike.%Atestado%,servico.ilike.%Abonado%')
        .order('data', { ascending: false });

      // Aplica o Filtro de Datas
      if (dataInicio && dataInicio.length === 10) {
        const dtIniBD = converterParaBanco(dataInicio);
        if (dtIniBD) query = query.gte('data', `${dtIniBD} 00:00:00`);
      }
      if (dataFim && dataFim.length === 10) {
        const dtFimBD = converterParaBanco(dataFim);
        if (dtFimBD) query = query.lte('data', `${dtFimBD} 23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setAusenciasCadastradas(data);
    } catch (e: any) {
      Alert.alert("Erro", "Falha ao carregar lista de ausências.");
    }
    setCarregandoAusencias(false);
  };

  // === MÁSCARA E CONVERSÃO DE DATAS ===
  const aplicarMascaraData = (texto: string) => {
    let v = texto.replace(/\D/g, ''); 
    if (v.length > 8) v = v.substring(0, 8); 
    if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{1,4}).*/, '$1/$2/$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,2}).*/, '$1/$2');
    return v;
  };

  const converterParaBanco = (dataBR: string) => {
    const partes = dataBR.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return null;
  };

  const formatarDataParaBR = (dataIso: string) => {
    if (!dataIso) return '';
    const partes = dataIso.split('T')[0].split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataIso;
  };

  // ================= LÓGICA DE CADASTRO =================
  const salvarAusencia = async () => {
    if (!colaborador || !tipoAusencia) {
      return Alert.alert("Aviso", "Selecione o colaborador e o tipo de ocorrência!");
    }

    let dataLancamentoBD = null;

    if (tipoAusencia === 'Atestado') {
      if (!dataAtestado || dataAtestado.length !== 10 || !diasAtestado || !cidAtestado) {
        return Alert.alert("Aviso", "Preencha a data (completa), os dias e a CID do atestado médico!");
      }
      dataLancamentoBD = converterParaBanco(dataAtestado);
    }

    if (tipoAusencia === 'Abonado') {
      if (!dataAbono || dataAbono.length !== 10) {
        return Alert.alert("Aviso", "Preencha a data do abono corretamente (DD/MM/AAAA)!");
      }
      if (!motivoAbono.trim()) {
        return Alert.alert("Aviso", "Por favor, digite o motivo do abonamento pela empresa!");
      }
      dataLancamentoBD = converterParaBanco(dataAbono);
    }

    setSalvando(true);

    const servicoFinal = tipoAusencia === 'Abonado' ? `Abonado (${motivoAbono})` : tipoAusencia;

    const payload: any = { 
      colaborador: colaborador, 
      servico: servicoFinal, 
      fazenda: '-', quadra: '-', ramal: '-', quantidade: 0, valor_unitario: 0, valor_total: 0,
      data_atestado: tipoAusencia === 'Atestado' ? dataLancamentoBD : null,
      dias_atestado: tipoAusencia === 'Atestado' ? parseInt(diasAtestado) : null,
      cid_atestado: tipoAusencia === 'Atestado' ? cidAtestado : null
    };

    if (dataLancamentoBD) payload.data = dataLancamentoBD;

    const { error } = await supabase.from('diarios_campo').insert([payload]);

    setSalvando(false);

    if (error) {
      Alert.alert("Erro ao salvar", error.message);
    } else {
      Alert.alert("✅ Sucesso!", `Lançamento registrado para ${colaborador} com sucesso!`);
      setColaborador(''); setDataAtestado(''); setDiasAtestado(''); setCidAtestado(''); setDataAbono(''); setMotivoAbono('');
    }
  };

  // ================= LÓGICA DE GESTÃO (EXCLUIR / EDITAR) =================
  const excluirAusencia = (id: string, nomeExclusao: string) => {
    Alert.alert(
      "Excluir Registro",
      `Tem certeza que deseja apagar a ausência de ${nomeExclusao}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('diarios_campo').delete().eq('id', id);
            if (error) {
              Alert.alert("Erro", "Não foi possível excluir o registro.");
            } else {
              carregarAusenciasGerais(); // Atualiza a lista
            }
          }
        }
      ]
    );
  };

  const abrirEdicao = (item: any) => {
    setEditId(item.id);
    setEditColaborador(item.colaborador);
    
    if (String(item.servico).includes('Abonado')) {
      setEditTipoAusencia('Abonado');
      const motivoExtraido = String(item.servico).replace('Abonado (', '').replace(')', '');
      setEditMotivo(motivoExtraido);
      setEditData(formatarDataParaBR(item.data));
    } else {
      setEditTipoAusencia('Atestado');
      setEditData(formatarDataParaBR(item.data_atestado || item.data));
      setEditDias(String(item.dias_atestado || ''));
      setEditCid(item.cid_atestado || '');
    }
    
    setModalEdicaoVisivel(true);
  };

  const salvarAlteracaoEdicao = async () => {
    let dataBD = converterParaBanco(editData);
    if (!dataBD) return Alert.alert("Aviso", "Preencha a data corretamente.");

    if (editTipoAusencia === 'Abonado' && !editMotivo) {
      return Alert.alert("Aviso", "Preencha o motivo do abono.");
    }
    if (editTipoAusencia === 'Atestado' && (!editDias || !editCid)) {
      return Alert.alert("Aviso", "Preencha os dias e a CID do atestado.");
    }

    setSalvandoEdicao(true);
    const servicoFinal = editTipoAusencia === 'Abonado' ? `Abonado (${editMotivo})` : editTipoAusencia;

    const payload = {
      servico: servicoFinal,
      data: dataBD,
      data_atestado: editTipoAusencia === 'Atestado' ? dataBD : null,
      dias_atestado: editTipoAusencia === 'Atestado' ? parseInt(editDias) : null,
      cid_atestado: editTipoAusencia === 'Atestado' ? editCid : null
    };

    const { error } = await supabase.from('diarios_campo').update(payload).eq('id', editId);
    
    setSalvandoEdicao(false);

    if (error) {
      Alert.alert("Erro", "Falha ao atualizar o registro.");
    } else {
      Alert.alert("Sucesso", "Registro atualizado com sucesso!");
      setModalEdicaoVisivel(false);
      carregarAusenciasGerais();
    }
  };

  // ================= GERAÇÃO DE PDF =================
  const converterLogoParaBase64 = async () => {
    let base64Logo = '';
    try {
      const asset = Asset.fromModule(require('../../assets/images/logo.png'));
      await asset.downloadAsync();
      
      if (Platform.OS === 'web') {
        base64Logo = asset.uri;
      } else {
        let uriDaImagem = asset.localUri || asset.uri;
        if (uriDaImagem.startsWith('http')) {
          const { uri } = await FileSystem.downloadAsync(uriDaImagem, FileSystem.cacheDirectory + 'logo_temp_pdf.png');
          uriDaImagem = uri;
        }
        const base64 = await FileSystem.readAsStringAsync(uriDaImagem, { encoding: FileSystem.EncodingType.Base64 });
        base64Logo = `data:image/png;base64,${base64}`;
      }
    } catch (imgErr) {
      console.warn("Aviso: Não foi possível carregar a logo para o PDF.", imgErr);
    }
    return base64Logo;
  };

  const gerarPDFAusencias = async () => {
    if (ausenciasCadastradas.length === 0) {
      return Alert.alert('Aviso', 'Nenhuma ausência encontrada no período filtrado para gerar o PDF.');
    }
    setGerandoPdf(true);

    try {
      const base64Logo = await converterLogoParaBase64();

      let linhasTabela = '';
      ausenciasCadastradas.forEach((item: any) => {
        const isAbonado = item.servico.includes('Abonado');
        linhasTabela += `
          <tr>
            <td style="text-align: left; font-weight: bold;">${item.colaborador}</td>
            <td style="text-align: left; color: ${isAbonado ? '#34495E' : '#2980B9'};">${item.servico}</td>
            <td>${formatarDataParaBR(item.data)}</td>
            <td>${item.dias_atestado || '-'}</td>
            <td>${item.cid_atestado || '-'}</td>
          </tr>
        `;
      });

      const htmlCompleto = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Relatório de Ausências</title>
            <style>
              @page { margin: 15mm; size: A4 portrait; }
              body { font-family: 'Arial', sans-serif; font-size: 11px; color: #333; margin: 0; padding: 0; }
              .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #2C3E50; padding-bottom: 15px; }
              .header-logo img { max-height: 60px; max-width: 120px; object-fit: contain; }
              .header-info { flex: 1; text-align: right; }
              h1 { margin: 0; font-size: 18px; color: #2C3E50; text-transform: uppercase; }
              p { margin: 4px 0; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #BDC3C7; padding: 8px 4px; text-align: center; }
              th { background-color: #2C3E50; color: #FFF; font-weight: bold; text-transform: uppercase; font-size: 10px; }
              tr:nth-child(even) { background-color: #F4F6F6; }
            </style>
          </head>
          <body>
            <div class="header-container">
              ${base64Logo ? `<div class="header-logo"><img src="${base64Logo}" alt="Logo" /></div>` : ''}
              <div class="header-info">
                <h1>Relatório de Ausências / Atestados</h1>
                <p>Período: <strong>${dataInicio} a ${dataFim}</strong></p>
                <p>Total de Registros: <strong>${ausenciasCadastradas.length}</strong></p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25%; text-align: left;">Funcionário</th>
                  <th style="width: 35%; text-align: left;">Tipo / Motivo</th>
                  <th style="width: 15%;">Data</th>
                  <th style="width: 10%;">Dias</th>
                  <th style="width: 15%;">CID</th>
                </tr>
              </thead>
              <tbody>${linhasTabela}</tbody>
            </table>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(htmlCompleto);
          doc.close();
        }

        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);

      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlCompleto });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }

    } catch (err: any) {
      Alert.alert('Erro', 'Ocorreu um problema ao gerar o PDF: ' + err.message);
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Controle de Ponto 📅</Text>
        <Text style={styles.subtitle}>Lançamento e Gestão de Ausências</Text>
      </View>

      {/* 👉 ABAS NAVEGÁVEIS */}
      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'cadastrar' && styles.abaAtiva]} onPress={() => setAbaAtiva('cadastrar')}>
          <Text style={[styles.abaTexto, abaAtiva === 'cadastrar' && styles.abaTextoAtivo]}>+ Novo Lançamento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.abaBotao, abaAtiva === 'gerenciar' && styles.abaAtiva]} onPress={() => setAbaAtiva('gerenciar')}>
          <Text style={[styles.abaTexto, abaAtiva === 'gerenciar' && styles.abaTextoAtivo]}>📋 Gerenciar & Relatório</Text>
        </TouchableOpacity>
      </View>

      {/* ================= ABA DE CADASTRO ================= */}
      {abaAtiva === 'cadastrar' && (
        <View style={styles.card}>
          {carregandoDados ? (
            <View style={{alignItems: 'center', marginVertical: 20}}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={{marginTop: 10, color: '#7F8C8D'}}>Carregando equipe...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Colaborador:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                  <Picker.Item label="Selecione quem ausentou..." value="" />
                  {listaColaboradores.map((item) => (
                    <Picker.Item key={item.id} label={item.nome} value={item.nome} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Tipo de Ocorrência:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={tipoAusencia} onValueChange={setTipoAusencia} style={styles.picker}>
                  <Picker.Item label="Atestado Médico" value="Atestado" />
                  <Picker.Item label="Abonado pela Empresa" value="Abonado" />
                </Picker>
              </View>

              {/* SEÇÃO ATESTADO */}
              {tipoAusencia === 'Atestado' && (
                <View style={styles.atestadoBox}>
                  <Text style={styles.atestadoTitulo}>Detalhes do Atestado 🏥</Text>
                  
                  <Text style={styles.label}>Data do Atestado:</Text>
                  <TextInput 
                    style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10}
                    value={dataAtestado} onChangeText={(t) => setDataAtestado(aplicarMascaraData(t))} 
                  />

                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Dias de Duração:</Text>
                      <TextInput style={styles.input} placeholder="Ex: 3" keyboardType="numeric" value={diasAtestado} onChangeText={setDiasAtestado} />
                    </View>
                    <View style={styles.col}>
                      <Text style={styles.label}>Código CID:</Text>
                      <TextInput style={styles.input} placeholder="Ex: J01.9" value={cidAtestado} onChangeText={setCidAtestado} autoCapitalize="characters" />
                    </View>
                  </View>
                </View>
              )}

              {/* SEÇÃO ABONADO */}
              {tipoAusencia === 'Abonado' && (
                <View style={styles.abonoBox}>
                  <Text style={styles.abonoTitulo}>Detalhes do Abonamento ✅</Text>
                  
                  <Text style={styles.label}>Data da Ausência:</Text>
                  <TextInput 
                    style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10}
                    value={dataAbono} onChangeText={(t) => setDataAbono(aplicarMascaraData(t))} 
                  />

                  <Text style={styles.label}>Motivo do Abono:</Text>
                  <TextInput style={styles.input} placeholder="Ex: Doação de sangue..." value={motivoAbono} onChangeText={setMotivoAbono} />
                </View>
              )}

              <View style={[styles.avisoBox, tipoAusencia === 'Abonado' ? styles.avisoAbono : styles.avisoAtestado]}>
                <Text style={styles.avisoTexto}>
                  {tipoAusencia === 'Abonado' 
                    ? "✅ Falta justificada/abonada pela empresa. O valor lançado será R$ 0,00." 
                    : "ℹ️ Ausência justificada (Saúde). O valor lançado será R$ 0,00."}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.button, salvando ? styles.buttonDisabled : null, tipoAusencia === 'Abonado' ? styles.btnAbono : styles.btnAtestado]} 
                onPress={salvarAusencia} disabled={salvando}
              >
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Registrar {tipoAusencia}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ================= ABA DE GERENCIAMENTO E RELATÓRIO ================= */}
      {abaAtiva === 'gerenciar' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Filtros do Relatório</Text>
          
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Data Inicial:</Text>
              <TextInput 
                style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10}
                value={dataInicio} onChangeText={(t) => setDataInicio(aplicarMascaraData(t))} 
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Data Final:</Text>
              <TextInput 
                style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10}
                value={dataFim} onChangeText={(t) => setDataFim(aplicarMascaraData(t))} 
              />
            </View>
          </View>

          <View style={styles.rowBotoesFiltro}>
            <TouchableOpacity style={styles.btnBuscar} onPress={carregarAusenciasGerais}>
              <Text style={styles.btnBuscarTexto}>🔍 Buscar Dados</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnExportarPdf, gerandoPdf || ausenciasCadastradas.length === 0 ? styles.buttonDisabled : null]} 
              onPress={gerarPDFAusencias} 
              disabled={gerandoPdf || ausenciasCadastradas.length === 0}
            >
              {gerandoPdf ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnPdfTexto}>🖨️ Gerar PDF</Text>}
            </TouchableOpacity>
          </View>

          <Text style={[styles.formTitle, {marginTop: 20}]}>Registros Encontrados ({ausenciasCadastradas.length})</Text>
          
          {carregandoAusencias ? (
             <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 20 }} />
          ) : ausenciasCadastradas.length === 0 ? (
             <Text style={styles.emptyState}>Nenhum atestado ou abono registrado neste período.</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {ausenciasCadastradas.map((item) => (
                <View key={item.id} style={styles.itemLista}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemNome}>{item.colaborador}</Text>
                    <Text style={styles.itemTipo}>📌 {item.servico}</Text>
                    <Text style={styles.itemDetalhes}>
                      📅 {formatarDataParaBR(item.data)} 
                      {item.dias_atestado ? ` | ⏱️ ${item.dias_atestado} Dias` : ''} 
                      {item.cid_atestado ? ` | 🏷️ CID: ${item.cid_atestado}` : ''}
                    </Text>
                  </View>
                  <View style={styles.itemAcoes}>
                    <TouchableOpacity style={styles.btnEditarIcon} onPress={() => abrirEdicao(item)}>
                      <Ionicons name="create-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnExcluirIcon} onPress={() => excluirAusencia(item.id, item.colaborador)}>
                      <Ionicons name="trash-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ================= MODAL DE EDIÇÃO ================= */}
      <Modal visible={modalEdicaoVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Registro</Text>
            <Text style={styles.modalSubtitle}>{editColaborador}</Text>
            
            <Text style={styles.label}>Tipo de Registro (Imutável):</Text>
            <TextInput style={[styles.input, {backgroundColor: '#EAEDED', color: '#7F8C8D'}]} value={editTipoAusencia} editable={false} />

            <Text style={styles.label}>Data da Ocorrência:</Text>
            <TextInput 
              style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10}
              value={editData} onChangeText={(t) => setEditData(aplicarMascaraData(t))} 
            />

            {editTipoAusencia === 'Atestado' && (
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Dias de Duração:</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editDias} onChangeText={setEditDias} />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Código CID:</Text>
                  <TextInput style={styles.input} value={editCid} onChangeText={setEditCid} autoCapitalize="characters" />
                </View>
              </View>
            )}

            {editTipoAusencia === 'Abonado' && (
              <View>
                <Text style={styles.label}>Motivo do Abono:</Text>
                <TextInput style={styles.input} value={editMotivo} onChangeText={setEditMotivo} />
              </View>
            )}

            <View style={styles.rowBotoesModal}>
              <TouchableOpacity style={[styles.btnModalAcao, { backgroundColor: '#95A5A6' }]} onPress={() => setModalEdicaoVisivel(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnModalAcao, { backgroundColor: '#27AE60' }]} onPress={salvarAlteracaoEdicao} disabled={salvandoEdicao}>
                {salvandoEdicao ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
            
          </View>
        </View>
      </Modal>

      <View style={{height: 50}} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  header: { marginBottom: 20, marginTop: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', marginTop: 5 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  
  menuAbas: { flexDirection: 'row', backgroundColor: '#E0E6ED', borderRadius: 10, padding: 4, marginBottom: 20 },
  abaBotao: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  abaAtiva: { backgroundColor: '#FFFFFF', elevation: 2 },
  abaTexto: { fontWeight: 'bold', color: '#7F8C8D' },
  abaTextoAtivo: { color: '#2980B9' },

  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 10, borderColor: '#ECF0F1' },

  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8FAFC', color: '#2C3E50', height: 50 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  
  atestadoBox: { backgroundColor: '#EBF5FB', padding: 15, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#AED6F1' },
  atestadoTitulo: { fontSize: 16, fontWeight: 'bold', color: '#2980B9', marginBottom: 5, textAlign: 'center' },
  abonoBox: { backgroundColor: '#EAEDED', padding: 15, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#BDC3C7' },
  abonoTitulo: { fontSize: 16, fontWeight: 'bold', color: '#34495E', marginBottom: 5, textAlign: 'center' },

  avisoBox: { padding: 15, borderRadius: 8, marginTop: 20, borderWidth: 1 },
  avisoAbono: { backgroundColor: '#EAEDED', borderColor: '#7F8C8D' },
  avisoAtestado: { backgroundColor: '#E8F8F5', borderColor: '#27AE60' },
  avisoTexto: { color: '#2C3E50', fontSize: 14, textAlign: 'center', fontWeight: '500' },

  button: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  btnAbono: { backgroundColor: '#34495E' },
  btnAtestado: { backgroundColor: '#3498DB' },
  buttonDisabled: { backgroundColor: '#BDC3C7' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  // Botões do Filtro
  rowBotoesFiltro: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnBuscar: { flex: 1, backgroundColor: '#34495E', padding: 12, borderRadius: 8, alignItems: 'center', marginRight: 10 },
  btnBuscarTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  btnExportarPdf: { flex: 1, backgroundColor: '#E74C3C', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnPdfTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  // Estilos da Lista de Gestão
  emptyState: { textAlign: 'center', color: '#7F8C8D', fontStyle: 'italic', marginTop: 20 },
  itemLista: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#D5DBDB' },
  itemInfo: { flex: 1 },
  itemNome: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  itemTipo: { fontSize: 14, color: '#2980B9', fontWeight: '600', marginTop: 4 },
  itemDetalhes: { fontSize: 12, color: '#7F8C8D', marginTop: 4 },
  itemAcoes: { flexDirection: 'row', gap: 8 },
  btnEditarIcon: { backgroundColor: '#F1C40F', padding: 10, borderRadius: 8 },
  btnExcluirIcon: { backgroundColor: '#E74C3C', padding: 10, borderRadius: 8 },

  // Estilos do Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#7F8C8D', textAlign: 'center', marginBottom: 15 },
  rowBotoesModal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, gap: 10 },
  btnModalAcao: { flex: 1, paddingVertical: 15, borderRadius: 8, alignItems: 'center' }
});