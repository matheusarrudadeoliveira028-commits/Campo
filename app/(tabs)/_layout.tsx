import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drawer } from 'expo-router/drawer';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../../src/supabase';

export default function DrawerLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Estados para as travas
  const [liberarMapa, setLiberarMapa] = useState(true);
  const [liberarFinanceiro, setLiberarFinanceiro] = useState(false);
  const [liberarEquipe, setLiberarEquipe] = useState(false);

  useEffect(() => {
    carregarRegras();
  }, []);

  const carregarRegras = async () => {
    try {
      // 1. Vê quem é o usuário
      const perfilSalvo = await AsyncStorage.getItem('@perfil_offline');
      if (perfilSalvo) {
        setIsAdmin(JSON.parse(perfilSalvo).cargo === 'Administrador');
      }

      // 2. Tenta puxar a configuração global mais atualizada do Supabase
      const { data } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (data) {
        setLiberarMapa(data.permitir_mapa ?? true);
        setLiberarFinanceiro(data.permitir_financeiro ?? false);
        setLiberarEquipe(data.permitir_equipe ?? false);
      } else {
        // Se estiver offline, lê a mochila do celular
        const configOffline = await AsyncStorage.getItem('@config_global');
        if (configOffline) {
          const config = JSON.parse(configOffline);
          setLiberarMapa(config.permitir_mapa ?? true);
          setLiberarFinanceiro(config.permitir_financeiro ?? false);
          setLiberarEquipe(config.permitir_equipe ?? false);
        }
      }
    } catch (e) {
      console.log("Erro ao carregar regras de acesso");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerStyle: { backgroundColor: '#2C3E50' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: 'bold' },
          drawerActiveBackgroundColor: '#27AE60',
          drawerActiveTintColor: '#FFF',
          drawerInactiveTintColor: '#34495E',
          drawerLabelStyle: { fontSize: 16, fontWeight: 'bold' }
        }}
      >
        
        {/* TELA 1: Lançamentos (SEMPRE LIVRE) */}
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Lançar Produção',
            title: 'Menu Principal',
            drawerIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
          }}
        />

        {/* TELA 2: Mapa (OBEDECE A TRAVA) */}
        <Drawer.Screen
          name="mapa"
          options={{
            drawerLabel: 'Mapa da Fazenda',
            title: 'Mapa',
            drawerIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
            // Mostra se for Admin OU se o botão geral do mapa estiver ligado
            drawerItemStyle: (isAdmin || liberarMapa) ? {} : { display: 'none' } 
          }}
        />

        {/* TELA 3: Fechamento Financeiro (OBEDECE A TRAVA) */}
        <Drawer.Screen
          name="fechamento"
          options={{
            drawerLabel: 'Fechamento Financeiro',
            title: 'Folha de Pagamento',
            drawerIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />,
            drawerItemStyle: (isAdmin || liberarFinanceiro) ? {} : { display: 'none' } 
          }}
        />

        {/* TELA 4: Cadastro de Equipe (OBEDECE A TRAVA) */}
        <Drawer.Screen
          name="usuarios"
          options={{
            drawerLabel: 'Gestão de Acessos',
            title: 'Equipe do Sistema',
            drawerIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
            drawerItemStyle: (isAdmin || liberarEquipe) ? {} : { display: 'none' }
          }}
        />

        {/* TELA 5: Configurações (SEMPRE LIVRE, MAS CONTEÚDO MUDA LÁ DENTRO) */}
        <Drawer.Screen
          name="configuracoes"
          options={{
            drawerLabel: 'Configurações / Sair',
            title: 'Ajustes',
            drawerIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          }}
        />

      </Drawer>
    </GestureHandlerRootView>
  );
}