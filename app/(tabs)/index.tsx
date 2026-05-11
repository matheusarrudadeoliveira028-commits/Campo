import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  
  const [listaColaboradores, setListaColaboradores] = useState<any[]>([]);
  const [listaServicos, setListaServicos] = useState<any[]>([]);
  const [mapaCompleto, setMapaCompleto] = useState<any[]>([]);
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<string[]>([]);
  const [quadrasDisponiveis, setQuadrasDisponiveis] = useState<string[]>([]);
  const [ramaisDisponiveis, setRamaisDisponiveis] = useState<any[]>([]);
  const [limitePes, setLimitePes] = useState<number | null>(null);
  
  const [salvando, setSalvando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [dataHoraAtual, setDataHoraAtual] = useState(new Date());

  const [perfilLogado, setPerfilLogado] = useState<any>(null);
  const [lancamentosPendentes, setLancamentosPendentes] = useState<any[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  
  const [isOffline, setIsOffline] = useState(false);

  // Controle de fotos tiradas hoje
  const [fotosTiradasHoje, setFotosTiradasHoje] = useState<string[]>([]);
  const [fotoJaTirada, setFotoJaTirada] = useState(false);

  // Controle de Horário Permitido
  const [horaInicioPermitida, setHoraInicioPermitida] = useState('06:00');
  const [horaFimPermitida, setHoraFimPermitida] = useState('18:00');

  // ESTADOS DOS MODAIS
  const [modalEquipeVisivel, setModalEquipeVisivel] = useState(false);
  const [modalPendentesVisivel, setModalPendentesVisivel] = useState(false);

  // ESTADOS DA CÂMERA
  const [permissaoCamera, pedirPermissao] = useCameraPermissions();
  const [cameraVisivel, setCameraVisivel] = useState(false);
  const [fotoURI, setFotoURI] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    carregarUsuarioLogado(); 
    carregarLancamentosLocais(); 
    carregarControleDeFotos();
    const timer = setInterval(() => setDataHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const carregarControleDeFotos = async () => {
    try {
      const dataHoje = new Date().toISOString().split('T')[0];
      const dadosStr = await AsyncStorage.getItem(`@fotos_dia_${dataHoje}`);
      if (dadosStr) {
        setFotosTiradasHoje(JSON.parse(dadosStr));
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const chavesAntigas = keys.filter(k => k.startsWith('@fotos_dia_') && k !== `@fotos_dia_${dataHoje}`);
        await AsyncStorage.multiRemove(chavesAntigas);
        setFotosTiradasHoje([]);
      }
    } catch (e) {
      console.log("Erro ao carregar controle de fotos");
    }
  };

  useEffect(() => {
    if (colaborador && fotosTiradasHoje.includes(colaborador)) {
      setFotoJaTirada(true);
    } else {
      setFotoJaTirada(false);
    }
  }, [colaborador, fotosTiradasHoje]);

  const carregarUsuarioLogado = async () => {
    try {
      const perfilSalvoStr = await AsyncStorage.getItem('@perfil_offline');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session && !sessionError) {
        const { data: perfilData, error: perfilError } = await supabase.from('perfis').select('*').eq('id', session.user.id).single();
        
        if (perfilData && !perfilError) {
          setPerfilLogado(perfilData);
          await AsyncStorage.setItem('@perfil_offline', JSON.stringify(perfilData));
          carregarDadosBase(perfilData, session.user.id);
          setIsOffline(false);
        } else {
          acionarMochilaDePerfil(perfilSalvoStr);
        }
      } else {
        acionarMochilaDePerfil(perfilSalvoStr);
      }
    } catch (e) {
      const perfilSalvoStr = await AsyncStorage.getItem('@perfil_offline');
      acionarMochilaDePerfil(perfilSalvoStr);
    }
  };

  const acionarMochilaDePerfil = (perfilSalvoStr: string | null) => {
    setIsOffline(true);
    if (perfilSalvoStr) {
      const p = JSON.parse(perfilSalvoStr);
      setPerfilLogado(p);
      carregarDadosBase(p, p.id);
    } else {
      // Se não tem dados, apenas mostra "Perfil Desconhecido" na tela para não travar
      setPerfilLogado({ nome: 'Desconhecido' });
    }
  };

  const carregarLancamentosLocais = async () => {
    try {
      const dados = await AsyncStorage.getItem('@lancamentos_off');
      if (dados) setLancamentosPendentes(JSON.parse(dados));
    } catch (e) {
      console.log("Erro ao carregar dados locais");
    }
  };

  const carregarDadosBase = async (perfilLido: any, userIdLido: string | null) => {
    setCarregandoDados(true);
    try {
      const { data: colabs, error: errColab } = await supabase.from('colaboradores').select('*').order('nome');
      const { data: servs, error: errServ } = await supabase.from('servicos').select('*').order('nome');
      const { data: mapa, error: errMapa } = await supabase.from('mapa_fazendas').select('*');
      const { data: config, error: errConfig } = await supabase.from('configuracoes').select('*').single();

      if (errColab || errServ || errMapa) throw new Error("Sem rede");

      if (config) {
        setHoraInicioPermitida(config.hora_inicio);
        setHoraFimPermitida(config.hora_fim);
        await AsyncStorage.setItem('@config_horarios', JSON.stringify({ inicio: config.hora_inicio, fim: config.hora_fim }));
      }

      if (colabs) { setListaColaboradores(colabs); await AsyncStorage.setItem('@mochila_colaboradores', JSON.stringify(colabs)); }
      if (servs) { setListaServicos(servs); await AsyncStorage.setItem('@mochila_servicos', JSON.stringify(servs)); }
      if (mapa) {
        setMapaCompleto(mapa);
        setFazendasDisponiveis([...new Set(mapa.map(item => item.fazenda))] as string[]);
        await AsyncStorage.setItem('@mochila_mapa', JSON.stringify(mapa));
      }
      setIsOffline(false);
    } catch (error) {
      setIsOffline(true);
      const mochilaColabs = await AsyncStorage.getItem('@mochila_colaboradores');
      const mochilaServs = await AsyncStorage.getItem('@mochila_servicos');
      const mochilaMapa = await AsyncStorage.getItem('@mochila_mapa');
      const mochilaConfig = await AsyncStorage.getItem('@config_horarios');

      if (mochilaConfig) {
        const conf = JSON.parse(mochilaConfig);
        setHoraInicioPermitida(conf.inicio);
        setHoraFimPermitida(conf.fim);
      }
      if (mochilaColabs) setListaColaboradores(JSON.parse(mochilaColabs));
      if (mochilaServs) setListaServicos(JSON.parse(mochilaServs));
      if (mochilaMapa) {
        const mapaParsed = JSON.parse(mochilaMapa);
        setMapaCompleto(mapaParsed);
        setFazendasDisponiveis([...new Set(mapaParsed.map((item: any) => item.fazenda))] as string[]);
      }
    }
    setCarregandoDados(false);
  };

  const atualizarMochilaManual = () => { carregarUsuarioLogado(); Alert.alert("Atualizando", "Buscando dados na nuvem..."); };

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
      alert(`⚠️ Limite do ramal é ${limitePes} pés!`);
      setQuantidade(limitePes.toString());
    } else setQuantidade(texto);
  };

  const abrirCamera = async () => {
    if (!permissaoCamera?.granted) {
      const resposta = await pedirPermissao();
      if (!resposta.granted) return Alert.alert("Aviso", "Precisamos da câmera para a Prova de Vida!");
    }
    setCameraVisivel(true);
  };

  const tirarFoto = async () => {
    if (cameraRef.current) {
      try {
        const fotoOriginal = await cameraRef.current.takePictureAsync({ base64: false });
        const fotoComprimida = await ImageManipulator.manipulateAsync(
          fotoOriginal.uri,
          [{ resize: { width: 600 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        setFotoURI(fotoComprimida.uri);
        setCameraVisivel(false);
      } catch (e) {
        Alert.alert("Erro", "Falha ao capturar a imagem.");
      }
    }
  };

  const salvarLancamento = async () => {
    if (!colaborador || !servico || !fazenda || !quadra || !ramal || !quantidade) { return Alert.alert("Aviso", "Preencha todos os campos!"); }
    
    const horaAtual = dataHoraAtual.toLocaleTimeString('pt-BR').substring(0, 5); 
    if (horaAtual < horaInicioPermitida || horaAtual > horaFimPermitida) {
      return Alert.alert(
        "🚫 Fora do Expediente", 
        `Lançamentos permitidos apenas entre ${horaInicioPermitida} e ${horaFimPermitida}.`
      );
    }

    if (!fotoJaTirada && !fotoURI) { 
      return Alert.alert("Falta a Foto!", "A auditoria visual (foto) é obrigatória para o primeiro lançamento do dia."); 
    }

    const ramalInfo = ramaisDisponiveis.find(r => r.ramal === ramal);
    const isServicoAtualCoringa = servicoSelecionadoCompleto?.is_coringa === true;

    if (ramalInfo?.servico_permitido && servico !== ramalInfo.servico_permitido && !isServicoAtualCoringa) { 
      return Alert.alert("❌ Bloqueado", `Este ramal só aceita: ${ramalInfo.servico_permitido}. (E o serviço '${servico}' não é Coringa)`); 
    }

    if (ramalInfo?.data_bloqueio) {
      const hojeISO = dataHoraAtual.toISOString().split('T')[0];
      if (hojeISO !== ramalInfo.data_bloqueio) { return Alert.alert("📅 Data Bloqueada", `Lançamentos permitidos apenas em: ${new Date(ramalInfo.data_bloqueio + 'T00:00:00').toLocaleDateString('pt-BR')}`); }
    }

    setSalvando(true);
    let valorUnitario = servicoSelecionadoCompleto?.preco_base || 0;
    if (servicoSelecionadoCompleto?.tipo_cobranca === 'milheiro') valorUnitario = valorUnitario / 1000;

    const novoLancamento = { 
      colaborador, 
      servico, 
      fazenda, 
      quadra, 
      ramal, 
      quantidade: parseInt(quantidade), 
      valor_unitario: valorUnitario, 
      valor_total: valorTotalCalculado, 
      data: dataHoraAtual.toISOString(),
      foto_local: fotoURI, 
      fiscal_nome: perfilLogado?.nome || 'Fiscal Não Identificado' 
    };

    try {
      const novaLista = [...lancamentosPendentes, novoLancamento];
      await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
      setLancamentosPendentes(novaLista);

      if (fotoURI && !fotoJaTirada) {
        const novaListaFotosHoje = [...fotosTiradasHoje, colaborador];
        setFotosTiradasHoje(novaListaFotosHoje);
        const dataHoje = dataHoraAtual.toISOString().split('T')[0];
        await AsyncStorage.setItem(`@fotos_dia_${dataHoje}`, JSON.stringify(novaListaFotosHoje));
      }

      Alert.alert(
        "✅ Salvo Offline", 
        `Lançamento de ${servico} registrado.\nValor garantido: R$ ${valorTotalCalculado.toFixed(2).replace('.', ',')}`
      );

      setRamal(''); setQuantidade(''); setValorTotalCalculado(0); setFotoURI(null);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const sincronizarComBanco = async () => {
    if (lancamentosPendentes.length === 0) return;
    setSincronizando(true);

    try {
      const lancamentosProntosParaNuvem = [];

      for (const item of lancamentosPendentes) {
        let urlDaFotoNaNuvem = null;

        if (item.foto_local) {
          const nomeArquivo = `foto_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          
          const formData = new FormData();
          formData.append('file', {
            uri: item.foto_local,
            name: nomeArquivo,
            type: 'image/jpeg',
          } as any);

          const { error: uploadError } = await supabase.storage
            .from('fotos_producao')
            .upload(nomeArquivo, formData);

          if (uploadError) {
            throw new Error(`Falha no upload da foto do(a) ${item.colaborador}: ` + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from('fotos_producao')
            .getPublicUrl(nomeArquivo);

          urlDaFotoNaNuvem = publicUrlData.publicUrl;
        }

        const { foto_local, ...dados } = item;
        lancamentosProntosParaNuvem.push({
          ...dados,
          foto_url: urlDaFotoNaNuvem 
        });
      }

      const { error: dbError } = await supabase.from('diarios_campo').insert(lancamentosProntosParaNuvem);
      if (dbError) throw dbError;
      
      await AsyncStorage.removeItem('@lancamentos_off');
      setLancamentosPendentes([]);
      carregarDadosBase(perfilLogado, perfilLogado?.id || null);
      Alert.alert("🚀 Sincronizado com Sucesso!", "Todas as produções foram enviadas para o servidor.");
      
    } catch (e: any) {
      Alert.alert("Erro na Sincronização", "O envio foi interrompido: " + e.message);
    } finally {
      setSincronizando(false);
    }
  };

  const excluirLancamentoPendente = async (index: number) => {
    Alert.alert("Excluir Lançamento", "Tem certeza que deseja apagar este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim, Apagar", onPress: async () => {
          const novaLista = [...lancamentosPendentes];
          novaLista.splice(index, 1);
          await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
          setLancamentosPendentes(novaLista);
        }
      }
    ]);
  };

  const editarLancamentoPendente = async (index: number) => {
    const item = lancamentosPendentes[index];
    const novaLista = [...lancamentosPendentes];
    novaLista.splice(index, 1);
    await AsyncStorage.setItem('@lancamentos_off', JSON.stringify(novaLista));
    setLancamentosPendentes(novaLista);

    setColaborador(item.colaborador);
    setServico(item.servico);
    setFazenda(item.fazenda);
    setQuadra(item.quadra);
    setFotoURI(item.foto_local || null); 
    
    setModalPendentesVisivel(false);
    Alert.alert("Modo Edição", "Altere o que precisar e salve novamente.");
  };

  return (
    <View style={{flex: 1}}>
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>⚠️ MODO OFFLINE ATIVADO - Lançamentos salvos no celular.</Text>
        </View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View style={styles.topBar}>
          {perfilLogado ? (
            <Text style={styles.userText}>👤 Fiscal: {perfilLogado.nome}</Text>
          ) : (
            <Text style={styles.userText}>Buscando perfil...</Text>
          )}
          <TouchableOpacity onPress={() => setModalEquipeVisivel(true)} style={styles.btnEquipe}>
            <Text style={styles.btnEquipeText}>👥 Todos Colabs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Brekaz Produção </Text>
          <Text style={styles.subtitle}>Lançamento Livre para Todas as Equipes</Text>
          <View style={styles.relogioBox}>
              <Text style={styles.relogioTexto}>{dataHoraAtual.toLocaleDateString('pt-BR')} - {dataHoraAtual.toLocaleTimeString('pt-BR')}</Text>
              <TouchableOpacity onPress={atualizarMochilaManual} style={styles.btnAtualizar}>
                 <Text style={styles.btnAtualizarText}>🔄 Atualizar Base de Dados</Text>
              </TouchableOpacity>
          </View>
        </View>

        {lancamentosPendentes.length > 0 && (
          <View style={styles.syncCard}>
            <Text style={styles.syncTexto}>📦 {lancamentosPendentes.length} lançamentos pendentes</Text>
            <View style={styles.syncBotoesRow}>
              <TouchableOpacity style={styles.btnSyncVer} onPress={() => setModalPendentesVisivel(true)}>
                <Text style={styles.btnSyncVerTexto}>✏️ VER / EDITAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSync} onPress={sincronizarComBanco} disabled={sincronizando}>
                {sincronizando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSyncTexto}>🚀 ENVIAR TUDO</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.card}>
          {carregandoDados ? (
            <ActivityIndicator size="large" color="#27AE60" />
          ) : (
            <>
              <Text style={styles.label}>Colaborador:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={colaborador} onValueChange={setColaborador} style={styles.picker}>
                  <Picker.Item label="Quem está trabalhando?" value="" />
                  {listaColaboradores.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
                </Picker>
              </View>

              <Text style={styles.label}>Serviço:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={servico} onValueChange={(v) => { setServico(v); setServicoSelecionadoCompleto(listaServicos.find(s => s.nome === v)); }} style={styles.picker}>
                  <Picker.Item label="Qual o serviço?" value="" />
                  {listaServicos.map((item) => (<Picker.Item key={item.id} label={item.nome} value={item.nome} />))}
                </Picker>
              </View>

              <Text style={styles.label}>Fazenda:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={fazenda} onValueChange={setFazenda} style={styles.picker}>
                  <Picker.Item label="Selecione a fazenda..." value="" />
                  {fazendasDisponiveis.map((f, i) => (<Picker.Item key={i} label={f} value={f} />))}
                </Picker>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Quadra:</Text>
                  <View style={[styles.pickerContainer, !fazenda && styles.disabled]}><Picker enabled={!!fazenda} selectedValue={quadra} onValueChange={setQuadra} style={styles.picker}><Picker.Item label="..." value="" />{quadrasDisponiveis.map((q, i) => (<Picker.Item key={i} label={q} value={q} />))}</Picker></View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Ramal:</Text>
                  <View style={[styles.pickerContainer, !quadra && styles.disabled]}><Picker enabled={!!quadra} selectedValue={ramal} onValueChange={setRamal} style={styles.picker}><Picker.Item label="..." value="" />{ramaisDisponiveis.map((r, i) => (<Picker.Item key={i} label={r.ramal} value={r.ramal} />))}</Picker></View>
                </View>
              </View>

              <Text style={styles.label}>Quantidade (Pés):</Text>
              <TextInput style={[styles.input, !ramal && styles.disabledInput]} placeholder="0" keyboardType="numeric" value={quantidade} onChangeText={handleMudancaQuantidade} editable={!!ramal} />

              {valorTotalCalculado > 0 && (
                <View style={styles.cardGanho}>
                  <Text style={styles.textoGanho}>Valor deste lançamento:</Text>
                  <Text style={styles.valorGanho}>R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}</Text>
                </View>
              )}

              {colaborador ? (
                <View style={styles.areaCamera}>
                  {fotoJaTirada ? (
                    <View style={[styles.fotoSucessoCard, { borderColor: '#3498DB', backgroundColor: '#EBF5FB' }]}>
                      <Text style={{ fontSize: 24, marginHorizontal: 10 }}>🛡️</Text>
                      <View style={{flex: 1}}>
                        <Text style={{ color: '#2980B9', fontWeight: 'bold', fontSize: 14 }}>Auditoria já concluída hoje!</Text>
                        <Text style={{ color: '#7F8C8D', fontSize: 11 }}>Não é necessário tirar nova foto para este colaborador.</Text>
                      </View>
                    </View>
                  ) : fotoURI ? (
                    <View style={styles.fotoSucessoCard}>
                      <Image source={{ uri: fotoURI }} style={styles.miniFoto} />
                      <View style={{flex: 1, marginLeft: 15}}>
                        <Text style={styles.fotoSucessoTexto}>✅ Foto Registrada!</Text>
                        <TouchableOpacity onPress={() => setFotoURI(null)}>
                          <Text style={styles.fotoRefazerTexto}>Excluir e Tirar Outra</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.btnCamera} onPress={abrirCamera}>
                      <Text style={styles.btnCameraTexto}>📸 TIRAR FOTO (OBRIGATÓRIO)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              <TouchableOpacity style={[styles.button, salvando && styles.buttonDisabled]} onPress={salvarLancamento} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>💾 SALVAR NO CELULAR</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* MODAL DA CÂMERA EM TELA CHEIA */}
      <Modal visible={cameraVisivel} transparent={false} animationType="slide">
        <View style={styles.modalCameraContainer}>
          <CameraView style={styles.cameraVisor} facing="front" ref={cameraRef}>
            <View style={styles.cameraInterface}>
              <View style={styles.molduraRosto}>
                <Text style={styles.textoMoldura}>Centralize o Rosto</Text>
              </View>
              
              <View style={styles.cameraBotoesBarra}>
                <TouchableOpacity style={styles.btnFecharCamera} onPress={() => setCameraVisivel(false)}>
                  <Text style={styles.textoBotaoCamera}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnCapturar} onPress={tirarFoto}>
                  <View style={styles.btnCapturarMiolo} />
                </TouchableOpacity>

                <View style={{ width: 80 }} /> 
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* MODAL 1: LISTA DA EQUIPE */}
      <Modal visible={modalEquipeVisivel} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lista Geral ({listaColaboradores.length})</Text>
            <ScrollView style={{maxHeight: 400}}>
              {listaColaboradores.length === 0 ? (
                <Text style={styles.textoVazio}>Ninguém cadastrado no sistema.</Text>
              ) : (
                listaColaboradores.map(c => (
                  <View key={c.id} style={styles.itemEquipe}>
                    <Text style={styles.nomeEquipe}>👷 {c.nome}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalEquipeVisivel(false)}>
              <Text style={styles.btnFecharTexto}>FECHAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDITAR/EXCLUIR PENDENTES */}
      <Modal visible={modalPendentesVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentGrande}>
            <Text style={styles.modalTitle}>Lançamentos Pendentes</Text>
            <ScrollView style={{maxHeight: 500}}>
              {lancamentosPendentes.length === 0 ? (
                <Text style={styles.textoVazio}>Nenhum lançamento offline.</Text>
              ) : (
                lancamentosPendentes.map((item, index) => (
                  <View key={index} style={styles.itemPendente}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemColab}>{item.colaborador}</Text>
                      <Text style={styles.itemDetalhes}>{item.servico} | Ramal: {item.ramal}</Text>
                      <Text style={styles.itemDetalhes}>Qtd: {item.quantidade} | R$ {item.valor_total.toFixed(2)}</Text>
                      {item.foto_local && <Text style={{fontSize: 10, color: '#27AE60'}}>📸 Foto Anexada</Text>}
                    </View>
                    <View style={styles.itemAcoes}>
                      <TouchableOpacity style={styles.btnEditarPendente} onPress={() => editarLancamentoPendente(index)}>
                        <Text style={styles.btnAcaoTexto}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnApagarPendente} onPress={() => excluirLancamentoPendente(index)}>
                        <Text style={styles.btnAcaoTexto}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalPendentesVisivel(false)}>
              <Text style={styles.btnFecharTexto}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F5F7FA', padding: 20 },
  offlineBadge: { backgroundColor: '#E74C3C', padding: 8, alignItems: 'center', justifyContent: 'center' },
  offlineText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 5, backgroundColor: '#FFF', padding: 12, borderRadius: 8, elevation: 2 },
  userText: { fontSize: 13, fontWeight: 'bold', color: '#2C3E50', flex: 1 },
  btnEquipe: { backgroundColor: '#3498DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, marginRight: 8 },
  btnEquipeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  header: { marginBottom: 20, marginTop: 10, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 16, color: '#7F8C8D', textAlign: 'center' },
  relogioBox: { backgroundColor: '#34495E', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center', width: '100%' },
  relogioTexto: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  btnAtualizar: { backgroundColor: '#27AE60', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  btnAtualizarText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  syncCard: { backgroundColor: '#F39C12', padding: 15, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  syncTexto: { color: '#FFF', fontWeight: 'bold', marginBottom: 10 },
  syncBotoesRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  btnSyncVer: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
  btnSyncVerTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  btnSync: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
  btnSyncTexto: { color: '#F39C12', fontWeight: 'bold', fontSize: 12 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 15, elevation: 5 },
  label: { fontSize: 14, fontWeight: '700', color: '#34495E', marginBottom: 5, marginTop: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  disabled: { backgroundColor: '#EAECEE', opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 12, fontSize: 18, backgroundColor: '#F8FAFC', height: 55 },
  disabledInput: { backgroundColor: '#EAECEE' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { width: '48%' },
  cardGanho: { backgroundColor: '#E8F8F5', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', borderLeftWidth: 5, borderLeftColor: '#27AE60' },
  textoGanho: { color: '#1E8449', fontSize: 13, fontWeight: 'bold' },
  valorGanho: { color: '#1E8449', fontSize: 24, fontWeight: '900' },
  button: { backgroundColor: '#2980B9', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  buttonDisabled: { backgroundColor: '#95A5A6' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  areaCamera: { marginTop: 25 },
  btnCamera: { backgroundColor: '#34495E', padding: 15, borderRadius: 8, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#BDC3C7' },
  btnCameraTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  fotoSucessoCard: { flexDirection: 'row', backgroundColor: '#E8F8F5', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#27AE60' },
  miniFoto: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#CCC' },
  fotoSucessoTexto: { color: '#1E8449', fontWeight: 'bold', fontSize: 16 },
  fotoRefazerTexto: { color: '#E74C3C', fontWeight: 'bold', fontSize: 12, marginTop: 5, textDecorationLine: 'underline' },
  modalCameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraVisor: { flex: 1 },
  cameraInterface: { flex: 1, justifyContent: 'space-between', backgroundColor: 'transparent' },
  molduraRosto: { alignSelf: 'center', marginTop: 100, width: 250, height: 300, borderWidth: 3, borderColor: '#27AE60', borderRadius: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(39, 174, 96, 0.1)' },
  textoMoldura: { color: '#FFF', fontWeight: 'bold', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 5 },
  cameraBotoesBarra: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 20 },
  btnFecharCamera: { padding: 15 },
  textoBotaoCamera: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  btnCapturar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  btnCapturarMiolo: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10 },
  modalContentGrande: { backgroundColor: '#FFF', width: '100%', borderRadius: 15, padding: 20, elevation: 10, flex: 0.9 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C3E50', marginBottom: 15, textAlign: 'center' },
  textoVazio: { textAlign: 'center', color: '#7F8C8D', marginVertical: 20 },
  itemEquipe: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ECF0F1' },
  nomeEquipe: { fontSize: 16, color: '#34495E', fontWeight: 'bold' },
  itemPendente: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D5DBDB', borderRadius: 8, padding: 12, marginBottom: 10, alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemColab: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  itemDetalhes: { fontSize: 13, color: '#7F8C8D', marginTop: 2 },
  itemAcoes: { flexDirection: 'row', gap: 10 },
  btnEditarPendente: { backgroundColor: '#F1C40F', padding: 10, borderRadius: 8 },
  btnApagarPendente: { backgroundColor: '#E74C3C', padding: 10, borderRadius: 8 },
  btnAcaoTexto: { fontSize: 16 },
  btnFecharModal: { backgroundColor: '#95A5A6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  btnFecharTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});