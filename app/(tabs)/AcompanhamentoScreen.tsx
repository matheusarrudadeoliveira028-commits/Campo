import { Picker } from '@react-native-picker/picker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/supabase'; // Ajuste o caminho se necessário

// 👉 ALGORITMO OFFLINE DE FERIADOS NACIONAIS (Fixos + Móveis como Páscoa e Carnaval)
const obterFeriadosNacionais = (ano: number) => {
  const feriados = [
    '01/01', // Confraternização Universal
    '21/04', // Tiradentes
    '01/05', // Dia do Trabalhador
    '07/09', // Independência do Brasil
    '12/10', // Nossa Senhora Aparecida
    '02/11', // Finados
    '15/11', // Proclamação da República
    '20/11', // Consciência Negra
    '25/12'  // Natal
  ];

  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f_calc = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f_calc + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
  const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;

  const pascoa = new Date(ano, mesPascoa - 1, diaPascoa);

  const addDias = (data: Date, dias: number) => {
    const r = new Date(data);
    r.setDate(r.getDate() + dias);
    return r;
  };

  const formatar = (dts: Date) => `${String(dts.getDate()).padStart(2, '0')}/${String(dts.getMonth() + 1).padStart(2, '0')}`;

  feriados.push(formatar(addDias(pascoa, -47))); // Carnaval
  feriados.push(formatar(addDias(pascoa, -2)));  // Sexta-feira Santa
  feriados.push(formatar(addDias(pascoa, 60)));  // Corpus Christi

  return feriados.map(dMes => `${ano}-${dMes.split('/')[1]}-${dMes.split('/')[0]}`);
};

export default function AcompanhamentoScreen() {
  const [fiscalSelecionado, setFiscalSelecionado] = useState('TODOS');
  const [listaFiscais, setListaFiscais] = useState<string[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [registros, setRegistros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Totais do dia
  const [totalQtd, setTotalQtd] = useState(0);
  const [totalValor, setTotalValor] = useState(0);

  // 🟢 ESTADO: Resumo Hierárquico por Serviço > Fazenda > Quadra > Ramal
  const [resumoHierarquico, setResumoHierarquico] = useState<any>({});
  const [mostrarResumoServicos, setMostrarResumoServicos] = useState(false);

  // Pega a data de hoje no formato DD/MM/AAAA para iniciar a tela
  useEffect(() => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    setDataSelecionada(`${dia}/${mes}/${ano}`);
    
    carregarFiscais();
  }, []);

  // Recarrega os dados sempre que a data ou o fiscal mudar
  useEffect(() => {
    if (dataSelecionada.length === 10) {
      buscarProducaoDoDia();
    }
  }, [dataSelecionada, fiscalSelecionado]);

  // Máscara Automática de Data
  const aplicarMascaraData = (texto: string) => {
    let valorSujo = texto.replace(/\D/g, ''); 
    if (valorSujo.length > 8) valorSujo = valorSujo.substring(0, 8); 

    if (valorSujo.length > 4) {
      valorSujo = valorSujo.replace(/^(\d{2})(\d{2})(\d+)/, '$1/$2/$3');
    } else if (valorSujo.length > 2) {
      valorSujo = valorSujo.replace(/^(\d{2})(\d+)/, '$1/$2');
    }

    setDataSelecionada(valorSujo);
  };

  const carregarFiscais = async () => {
    const { data } = await supabase.from('diarios_campo').select('fiscal_nome');
    if (data) {
      const unicos = [...new Set(data.map(item => item.fiscal_nome).filter(Boolean))];
      setListaFiscais(unicos.sort() as string[]);
    }
  };

  const converterDataParaBanco = (dataBR: string) => {
    const partes = dataBR.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return null;
  };

  const buscarProducaoDoDia = async () => {
    const dataBD = converterDataParaBanco(dataSelecionada);
    if (!dataBD) return;

    setCarregando(true);
    try {
      let query = supabase
        .from('diarios_campo')
        .select('*')
        .gte('data', `${dataBD} 00:00:00`)
        .lte('data', `${dataBD} 23:59:59`)
        .order('colaborador', { ascending: true });

      if (fiscalSelecionado !== 'TODOS') {
        query = query.eq('fiscal_nome', fiscalSelecionado);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // 👉 ALGORITMO DE AGRUPAMENTO DA TABELA
        const registrosAgrupados = data.reduce((acc: any, item: any) => {
          const chave = `${item.colaborador}_${item.servico}_${item.fazenda}_${item.quadra}_${item.valor_unitario}`;
          
          if (!acc[chave]) {
            acc[chave] = {
              ...item,
              quantidade: Number(item.quantidade) || 0,
              valor_total: Number(item.valor_total) || 0,
              ramais: item.ramal ? [String(item.ramal)] : []
            };
          } else {
            acc[chave].quantidade += Number(item.quantidade) || 0;
            acc[chave].valor_total += Number(item.valor_total) || 0;
            if (item.ramal) {
              acc[chave].ramais.push(String(item.ramal));
            }
          }
          return acc;
        }, {});

        const dadosUnificados = Object.values(registrosAgrupados).map((item: any) => {
          const ramaisUnicos = [...new Set(item.ramais)];
          return {
            ...item,
            ramal: ramaisUnicos.join(', ') || '-'
          };
        });

        dadosUnificados.sort((a: any, b: any) => a.colaborador.localeCompare(b.colaborador));
        setRegistros(dadosUnificados);
        
        const sumQtd = dadosUnificados.reduce((acc, item: any) => acc + (Number(item.quantidade) || 0), 0);
        const sumValor = dadosUnificados.reduce((acc, item: any) => acc + (Number(item.valor_total) || 0), 0);
        setTotalQtd(sumQtd);
        setTotalValor(sumValor);

        // 🟢 ALGORITMO DE AGRUPAMENTO HIERÁRQUICO (Serviço -> Fazenda -> Quadra -> Ramal)
        const hierarquia = data.reduce((acc: any, item: any) => {
          const s = item.servico || '-';
          const f = item.fazenda || '-';
          const q = item.quadra || '-';
          const r = item.ramal || '-';
          const qtd = Number(item.quantidade) || 0;

          // Cria Serviço se não existir
          if (!acc[s]) acc[s] = { total: 0, fazendas: {} };
          acc[s].total += qtd;

          // Cria Fazenda se não existir
          if (!acc[s].fazendas[f]) acc[s].fazendas[f] = { total: 0, quadras: {} };
          acc[s].fazendas[f].total += qtd;

          // Cria Quadra se não existir
          if (!acc[s].fazendas[f].quadras[q]) acc[s].fazendas[f].quadras[q] = { total: 0, ramais: {} };
          acc[s].fazendas[f].quadras[q].total += qtd;

          // Adiciona/Soma no Ramal
          if (!acc[s].fazendas[f].quadras[q].ramais[r]) acc[s].fazendas[f].quadras[q].ramais[r] = 0;
          acc[s].fazendas[f].quadras[q].ramais[r] += qtd;

          return acc;
        }, {});

        setResumoHierarquico(hierarquia);

      } else {
        setRegistros([]);
        setTotalQtd(0);
        setTotalValor(0);
        setResumoHierarquico({});
      }
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível carregar os dados do dia.');
      console.log(err);
    } finally {
      setCarregando(false);
    }
  };

  const gerarPDF = async () => {
    if (registros.length === 0) {
      return Alert.alert('Aviso', 'Não há registros para gerar o PDF neste dia.');
    }

    setGerandoPdf(true);

    try {
      let base64Logo = '';
      try {
        const asset = Asset.fromModule(require('../../assets/images/logo.png'));
        await asset.downloadAsync();
        
        if (Platform.OS === 'web') {
          base64Logo = asset.uri;
        } else {
          let uriDaImagem = asset.localUri || asset.uri;
          if (uriDaImagem.startsWith('http')) {
            const { uri } = await FileSystem.downloadAsync(
              uriDaImagem,
              FileSystem.cacheDirectory + 'logo_temp_pdf.png'
            );
            uriDaImagem = uri;
          }
          const base64 = await FileSystem.readAsStringAsync(uriDaImagem, {
            encoding: FileSystem.EncodingType.Base64,
          });
          base64Logo = `data:image/png;base64,${base64}`;
        }
      } catch (imgErr) {
        console.warn("Aviso: Não foi possível carregar a logo para o PDF.", imgErr);
      }

      let linhasTabela = '';
      registros.forEach((item: any) => {
        const valorUni = item.valor_unitario ? Number(item.valor_unitario).toFixed(4).replace('.', ',') : '0,00';
        const valorTot = item.valor_total ? Number(item.valor_total).toFixed(2).replace('.', ',') : '0,00';
        
        linhasTabela += `
          <tr>
            <td style="text-align: left; font-weight: bold;">${item.colaborador}</td>
            <td style="text-align: left;">${item.servico || '-'}</td>
            <td>${item.quadra || '-'}</td>
            <td>${item.ramal || '-'}</td>
            <td><strong>${item.quantidade || '0'}</strong></td>
            <td>R$ ${valorUni}</td>
            <td style="color: #27AE60;"><strong>R$ ${valorTot}</strong></td>
          </tr>
        `;
      });

      const htmlCompleto = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Relatório Diário de Produção</title>
            <style>
              @page { margin: 15mm; size: A4 portrait; }
              body { font-family: 'Arial', sans-serif; font-size: 11px; color: #333; margin: 0; padding: 0; }
              .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #2C3E50; padding-bottom: 15px; }
              .header-logo { margin-right: 15px; }
              .header-logo img { max-height: 60px; max-width: 120px; object-fit: contain; }
              .header-info { flex: 1; text-align: right; }
              h1 { margin: 0; font-size: 18px; color: #2C3E50; text-transform: uppercase; }
              p { margin: 4px 0; font-size: 12px; }
              .resumo-container { display: flex; justify-content: space-between; margin-bottom: 20px; background-color: #F8F9F9; padding: 15px; border-radius: 8px; border: 1px solid #E5E8E8; }
              .resumo-box { text-align: center; width: 48%; }
              .resumo-titulo { font-size: 11px; color: #7F8C8D; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
              .resumo-valor { font-size: 18px; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #BDC3C7; padding: 6px 4px; text-align: center; }
              th { background-color: #2C3E50; color: #FFF; font-weight: bold; text-transform: uppercase; font-size: 10px; }
              tr:nth-child(even) { background-color: #F4F6F6; }
            </style>
          </head>
          <body>
            <div class="header-container">
              ${base64Logo ? `<div class="header-logo"><img src="${base64Logo}" alt="Logo" /></div>` : ''}
              <div class="header-info">
                <h1>Acompanhamento Diário</h1>
                <p>Data de Referência: <strong>${dataSelecionada}</strong></p>
                <p>Equipe / Fiscal: <strong style="text-transform: uppercase;">${fiscalSelecionado}</strong></p>
              </div>
            </div>

            <div class="resumo-container">
              <div class="resumo-box">
                <div class="resumo-titulo">Total Produzido (Qtd)</div>
                <div class="resumo-valor" style="color: #2980B9;">${totalQtd}</div>
              </div>
              <div class="resumo-box">
                <div class="resumo-titulo">Total em Reais (R$)</div>
                <div class="resumo-valor" style="color: #27AE60;">R$ ${totalValor.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25%; text-align: left;">Funcionário</th>
                  <th style="width: 25%; text-align: left;">Serviço</th>
                  <th style="width: 10%;">Quadra</th>
                  <th style="width: 10%;">Ramal</th>
                  <th style="width: 10%;">Qtd</th>
                  <th style="width: 10%;">V. Unit</th>
                  <th style="width: 10%;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${linhasTabela}
              </tbody>
            </table>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
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
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Produção do Dia 📊</Text>
        <Text style={styles.subtitle}>Acompanhamento em tempo real</Text>
      </View>

      <View style={styles.cardFiltros}>
        <View style={styles.row}>
          <View style={[styles.col, { flex: 0.4 }]}>
            <Text style={styles.label}>Data:</Text>
            <TextInput 
              style={styles.input} 
              value={dataSelecionada} 
              onChangeText={aplicarMascaraData} 
              placeholder="DD/MM/AAAA" 
              keyboardType="numeric" 
              maxLength={10}
            />
          </View>
          <View style={[styles.col, { flex: 0.55 }]}>
            <Text style={styles.label}>Equipe (Fiscal):</Text>
            <View style={styles.pickerContainer}>
              <Picker 
                selectedValue={fiscalSelecionado} 
                onValueChange={setFiscalSelecionado} 
                style={styles.picker}
              >
                <Picker.Item label="Todas Equipes" value="TODOS" />
                {listaFiscais.map((nome, index) => (
                  <Picker.Item key={index} label={nome} value={nome} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.resumoContainer}>
          <View style={styles.resumoBox}>
            <Text style={styles.resumoTitulo}>Total Produzido (Qtd)</Text>
            <Text style={styles.resumoValorAzul}>{totalQtd}</Text>
          </View>
          <View style={styles.resumoBox}>
            <Text style={styles.resumoTitulo}>Total em Reais (R$)</Text>
            <Text style={styles.resumoValorVerde}>
              R$ {totalValor.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        {/* 🟢 LISTA HIERÁRQUICA: SERVIÇO > FAZENDA > QUADRA > RAMAL */}
        {Object.keys(resumoHierarquico).length > 0 && (
          <>
            <TouchableOpacity 
              onPress={() => setMostrarResumoServicos(!mostrarResumoServicos)} 
              style={styles.btnToggleResumo}
            >
              <Text style={styles.txtToggleResumo}>
                {mostrarResumoServicos ? 'Ocultar Detalhes por Serviço e Local' : 'Ver Detalhes por Serviço e Local'}
              </Text>
            </TouchableOpacity>

            {mostrarResumoServicos && (
              <View style={styles.containerResumoDetalhado}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
                  
                  {Object.keys(resumoHierarquico).sort().map((servico) => (
                    <View key={servico} style={styles.blocoServico}>
                      
                      {/* Nível 1: Serviço */}
                      <View style={styles.linhaServico}>
                        <Text style={styles.txtServicoTitulo}>{servico}</Text>
                        <Text style={styles.txtServicoTotal}>{resumoHierarquico[servico].total} un</Text>
                      </View>
                      
                      {/* Nível 2: Fazendas */}
                      {Object.keys(resumoHierarquico[servico].fazendas).sort().map((fazenda) => (
                        <View key={fazenda} style={styles.blocoFazenda}>
                          <View style={styles.linhaFazenda}>
                            <Text style={styles.txtFazendaTitulo}>📍 Fazenda {fazenda}</Text>
                            <Text style={styles.txtFazendaTotal}>{resumoHierarquico[servico].fazendas[fazenda].total} un</Text>
                          </View>
                          
                          {/* Nível 3: Quadras */}
                          {Object.keys(resumoHierarquico[servico].fazendas[fazenda].quadras)
                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                            .map((quadra) => (
                              <View key={quadra} style={styles.blocoQuadra}>
                                <View style={styles.linhaQuadra}>
                                  <Text style={styles.txtQuadraTitulo}>↳ Quadra {quadra}</Text>
                                  <Text style={styles.txtQuadraTotal}>{resumoHierarquico[servico].fazendas[fazenda].quadras[quadra].total} un</Text>
                                </View>

                                {/* 🟢 Nível 4: Ramais */}
                                {Object.keys(resumoHierarquico[servico].fazendas[fazenda].quadras[quadra].ramais)
                                  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                                  .map((ramal) => (
                                    <View key={ramal} style={styles.linhaRamal}>
                                      <Text style={styles.txtRamalTitulo}>• Ramal {ramal}</Text>
                                      <Text style={styles.txtRamalTotal}>{resumoHierarquico[servico].fazendas[fazenda].quadras[quadra].ramais[ramal]} un</Text>
                                    </View>
                                  ))}
                              </View>
                            ))}
                        </View>
                      ))}
                    </View>
                  ))}

                </ScrollView>
                <View style={styles.linhaTotalResumo}>
                  <Text style={styles.txtTotalGeralResumo}>TOTAL GERAL DO DIA:</Text>
                  <Text style={styles.txtValorTotalGeralResumo}>{totalQtd} un</Text>
                </View>
              </View>
            )}
          </>
        )}

        <TouchableOpacity 
          style={[styles.btnPdf, gerandoPdf || registros.length === 0 ? styles.btnPdfDisabled : null]} 
          onPress={gerarPDF} 
          disabled={gerandoPdf || registros.length === 0}
        >
          {gerandoPdf ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.btnPdfText}>🖨️ Exportar PDF do Dia</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabelaContainer}>
        {carregando ? (
          <ActivityIndicator size="large" color="#2980B9" style={{ marginTop: 50 }} />
        ) : registros.length === 0 ? (
          <Text style={styles.emptyState}>Nenhum serviço registrado neste dia.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1, minWidth: '100%' }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 150 }]}>Funcionário</Text>
                <Text style={[styles.th, { width: 140 }]}>Serviço</Text>
                <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Quadra</Text>
                <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Ramal</Text>
                <Text style={[styles.th, { width: 70, textAlign: 'center' }]}>Qtd</Text>
                <Text style={[styles.th, { width: 90, textAlign: 'right' }]}>Valor Unit.</Text>
                <Text style={[styles.th, { width: 90, textAlign: 'right' }]}>Total</Text>
              </View>

              <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
                {registros.map((item, index) => (
                  <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                    <Text style={[styles.td, { width: 150, fontWeight: 'bold' }]} numberOfLines={1}>
                      {item.colaborador}
                    </Text>
                    <Text style={[styles.td, { width: 140 }]} numberOfLines={1}>
                      {item.servico || '-'}
                    </Text>
                    <Text style={[styles.td, { width: 80, textAlign: 'center' }]}>
                      {item.quadra || '-'}
                    </Text>
                    <Text style={[styles.td, { width: 100, textAlign: 'center' }]}>
                      {item.ramal || '-'}
                    </Text>
                    <Text style={[styles.td, { width: 70, textAlign: 'center', fontWeight: 'bold' }]}>
                      {item.quantidade || '0'}
                    </Text>
                    <Text style={[styles.td, { width: 90, textAlign: 'right' }]}>
                      R$ {item.valor_unitario ? Number(item.valor_unitario).toFixed(4).replace('.', ',') : '0,00'}
                    </Text>
                    <Text style={[styles.td, { width: 90, textAlign: 'right', color: '#27AE60', fontWeight: 'bold' }]}>
                      R$ {item.valor_total ? Number(item.valor_total).toFixed(2).replace('.', ',') : '0,00'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, paddingTop: 30, backgroundColor: '#FFF', elevation: 2, borderBottomWidth: 1, borderBottomColor: '#E0E6ED' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50' },
  subtitle: { fontSize: 14, color: '#7F8C8D', marginTop: 2 },
  
  cardFiltros: { backgroundColor: '#FFFFFF', padding: 15, margin: 15, borderRadius: 12, elevation: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 150, marginHorizontal: 5, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: '#34495E', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#F8FAFC', color: '#2C3E50' },
  
  pickerContainer: { borderWidth: 1, borderColor: '#E0E6ED', borderRadius: 8, backgroundColor: '#F8FAFC', height: 42, justifyContent: 'center' },
  picker: { height: 80, width: '100%', borderWidth: 0, backgroundColor: 'transparent' },
  
  resumoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#ECF0F1' },
  resumoBox: { flex: 1, alignItems: 'center' },
  resumoTitulo: { fontSize: 11, color: '#7F8C8D', fontWeight: '600', textTransform: 'uppercase' },
  resumoValorAzul: { fontSize: 22, fontWeight: 'bold', color: '#2980B9', marginTop: 4 },
  resumoValorVerde: { fontSize: 22, fontWeight: 'bold', color: '#27AE60', marginTop: 4 },

  btnToggleResumo: { marginTop: 15, padding: 10, backgroundColor: '#EBF5FB', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#AED6F1' },
  txtToggleResumo: { color: '#2980B9', fontWeight: 'bold', fontSize: 13 },
  containerResumoDetalhado: { marginTop: 10, backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#BDC3C7' },
  
  // 🟢 ESTILOS HIERÁRQUICOS AJUSTADOS
  blocoServico: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#ECF0F1', paddingBottom: 10 },
  linhaServico: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2C3E50', padding: 8, borderRadius: 5 },
  txtServicoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
  txtServicoTotal: { fontSize: 14, fontWeight: 'bold', color: '#F1C40F' },
  
  blocoFazenda: { marginTop: 8, paddingLeft: 10 },
  linhaFazenda: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F4F6F6', padding: 6, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#27AE60' },
  txtFazendaTitulo: { fontSize: 13, fontWeight: 'bold', color: '#34495E' },
  txtFazendaTotal: { fontSize: 13, fontWeight: 'bold', color: '#27AE60' },
  
  blocoQuadra: { paddingBottom: 4 },
  linhaQuadra: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: 20 },
  txtQuadraTitulo: { fontSize: 12, fontWeight: 'bold', color: '#34495E' },
  txtQuadraTotal: { fontSize: 12, fontWeight: 'bold', color: '#34495E' },

  linhaRamal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingLeft: 35, borderBottomWidth: 1, borderBottomColor: '#F4F6F6' },
  txtRamalTitulo: { fontSize: 11, color: '#7F8C8D' },
  txtRamalTotal: { fontSize: 11, fontWeight: 'bold', color: '#7F8C8D' },

  linhaTotalResumo: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 10, marginTop: 5, borderTopWidth: 2, borderTopColor: '#2C3E50' },
  txtTotalGeralResumo: { fontSize: 12, fontWeight: 'bold', color: '#34495E', marginRight: 10 },
  txtValorTotalGeralResumo: { fontSize: 16, fontWeight: 'bold', color: '#27AE60' },

  btnPdf: { backgroundColor: '#34495E', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  btnPdfDisabled: { backgroundColor: '#95A5A6' },
  btnPdfText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  tabelaContainer: { flex: 1, backgroundColor: '#FFF', marginHorizontal: 15, marginBottom: 15, borderRadius: 12, elevation: 3, overflow: 'hidden' },
  emptyState: { textAlign: 'center', marginTop: 40, color: '#95A5A6', fontSize: 15, fontStyle: 'italic' },
  
  tableHeader: { flexDirection: 'row', backgroundColor: '#2C3E50', paddingVertical: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  th: { color: '#FFF', fontSize: 13, fontWeight: 'bold', paddingHorizontal: 10 },
  
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ECF0F1' },
  rowEven: { backgroundColor: '#FDFEFE' },
  rowOdd: { backgroundColor: '#F4F6F6' },
  td: { fontSize: 13, color: '#2C3E50', paddingHorizontal: 10 },
});