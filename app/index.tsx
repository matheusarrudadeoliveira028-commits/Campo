import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  // O aplicativo abre aqui e é chutado direto para a tela de Login isolada
  return <Redirect href="/login" />;
}