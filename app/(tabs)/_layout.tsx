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
          drawerLabelStyle: { 
            fontSize: 16, 
            fontWeight: 'bold',
            textTransform: 'capitalize' // 👉 Garante a primeira letra sempre Maiúscula
          }
        }}
      >
        
        {/* TELA 1: Lançar Produção */}
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Lançar Produção',
            title: 'Início',
            drawerIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
          }}
        />

        {/* TELA 2: Mapa da Fazenda */}
        <Drawer.Screen
          name="mapa"
          options={{
            drawerLabel: 'Mapa Da Fazenda',
            title: 'Mapa',
            drawerIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
            drawerItemStyle: (isAdmin || liberarMapa) ? {} : { display: 'none' } 
          }}
        />

        {/* TELA 3: Auditoria de Fotos (Adicionada conforme as telas anteriores) */}
        <Drawer.Screen
          name="auditoria"
          options={{
            drawerLabel: 'Auditoria De Fotos',
            title: 'Auditoria',
            drawerIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} />,
            // Se quiser que só Admin veja a auditoria, descomente a linha abaixo:
            // drawerItemStyle: isAdmin ? {} : { display: 'none' }
          }}
        />

        {/* TELA 4: Fechamento Financeiro */}
        <Drawer.Screen
          name="fechamento"
          options={{
            drawerLabel: 'Fechamento Financeiro',
            title: 'Financeiro',
            drawerIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />,
            drawerItemStyle: (isAdmin || liberarFinanceiro) ? {} : { display: 'none' } 
          }}
        />

        {/* TELA 5: Gestão de Acessos */}
        <Drawer.Screen
          name="usuarios"
          options={{
            drawerLabel: 'Gestão De Acessos',
            title: 'Equipe',
            drawerIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
            drawerItemStyle: (isAdmin || liberarEquipe) ? {} : { display: 'none' }
          }}
        />

        {/* TELA 6: Configurações */}
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