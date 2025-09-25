


import '@mantine/core/styles.css';



import { Route, BrowserRouter, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import Header from './components/Header/Header';
import { theme } from './theme';
import { Home } from '@/pages/Home.page';


export default function App() {
  return (
    <MantineProvider theme={theme}>
    
      <BrowserRouter>

        <Header />
      

        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      
      </BrowserRouter>
    </MantineProvider>
  );
}
