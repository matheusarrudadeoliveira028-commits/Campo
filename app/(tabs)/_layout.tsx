import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          // Cores do topo da tela
          headerStyle: { backgroundColor: '#2C3E50' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: 'bold' },
          
          // Cores do menu lateral
          drawerActiveBackgroundColor: '#27AE60',
          drawerActiveTintColor: '#FFF',
          drawerInactiveTintColor: '#34495E',
          drawerLabelStyle: { fontSize: 16, fontWeight: 'bold' }
        }}
      >
        
        {/* TELA 1: Lançamentos e Mapa (Juntos) */}
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Lançar Produção',
            title: 'Menu Principal',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="leaf" size={size} color={color} />
            ),
          }}
        />

        {/* TELA 2: Fechamento Financeiro */}
        <Drawer.Screen
          name="fechamento"
          options={{
            drawerLabel: 'Fechamento Financeiro',
            title: 'Folha de Pagamento',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="cash" size={size} color={color} />
            ),
          }}
        />

        {/* TELA 3: Cadastro de Equipe */}
        <Drawer.Screen
          name="usuarios"
          options={{
            drawerLabel: 'Gestão de Acessos',
            title: 'Equipe do Sistema',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />

      </Drawer>
    </GestureHandlerRootView>
  );
}