import { useState, useEffect } from 'react'
import './App.css'

// Definição dos tipos
interface Pedido {
  id: string;
  name: string;
  property_cliente: string;
  property_data_entrega: {
    start: string;
    end: string | null;
    time_zone: string | null;
  };
  property_bolo_pdm_g: number | null;
  property_bolo_pdm_p: number | null;
  property_bolo_de_mel_g_com_calda: number | null;
  property_bolo_choco_g: number | null;
  property_bolo_choco_p: number | null;
  [key: string]: any;
}

interface PedidoProcessado {
  cliente: string;
  bolos: {
    tipo: string;
    quantidade: number;
    abreviacao: string;
    cor: string;
    tamanho: string;
  }[];
  dataOriginal: string; // Data original do pedido
  dataFormatada: string; // Data formatada como DD/MM
}

interface BoloSomado {
  tipo: string;
  abreviacao: string;
  cor: string;
  pequeno: number;
  grande: number;
}

interface PedidosPorDia {
  [key: string]: {
    pedidos: PedidoProcessado[];
    somatorio: BoloSomado[];
    data: string;
    passado: boolean; // Indica se o dia já passou
  }
}

// Mapeamento dos nomes das propriedades para nomes mais amigáveis
const nomesBolos: {[key: string]: {nome: string, abreviacao: string, cor: string, tamanho: string, tipoBase: string}} = {
  'property_bolo_pdm_g': {nome: 'Bolo Pão de Mel Grande', abreviacao: 'PDM G', cor: '#F59E0B', tamanho: 'grande', tipoBase: 'PDM'},
  'property_bolo_pdm_p': {nome: 'Bolo Pão de Mel Pequeno', abreviacao: 'PDM P', cor: '#F59E0B', tamanho: 'pequeno', tipoBase: 'PDM'},
  'property_bolo_de_mel_g_com_calda': {nome: 'Bolo de Mel Grande com Calda', abreviacao: 'MEL G', cor: '#D97706', tamanho: 'grande', tipoBase: 'MEL'},
  'property_bolo_choco_g': {nome: 'Bolo de Chocolate Grande', abreviacao: 'CHOCO G', cor: '#7C2D12', tamanho: 'grande', tipoBase: 'CHOCO'},
  'property_bolo_choco_p': {nome: 'Bolo de Chocolate Pequeno', abreviacao: 'CHOCO P', cor: '#7C2D12', tamanho: 'pequeno', tipoBase: 'CHOCO'}
};

// Propriedades dos bolos que queremos monitorar
const propriedadesBolos = [
  'property_bolo_pdm_g',
  'property_bolo_pdm_p',
  'property_bolo_de_mel_g_com_calda',
  'property_bolo_choco_g',
  'property_bolo_choco_p'
];

// Dias da semana em português (excluindo domingo)
const diasSemana = [
  'segunda-feira',
  'terca-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sabado'
];

// Formatação dos nomes dos dias para exibição
const diasSemanaFormatados = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

// Versão da aplicação para forçar atualização de cache
const APP_VERSION = Date.now();

// Função para formatar data como DD/MM
const formatarDataDDMM = (data: Date): string => {
  const dia = data.getUTCDate().toString().padStart(2, '0');
  const mes = (data.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}`;
};

function App() {
  const [pedidosPorDia, setPedidosPorDia] = useState<PedidosPorDia>({});
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');
  const [atualizacaoAutomatica, setAtualizacaoAutomatica] = useState<boolean>(true);
  const [numeroSemana, setNumeroSemana] = useState<number>(0);
  // const [datasSemanaAtual, setDatasSemanaAtual] = useState<string[]>([]); // Removido - não utilizado
  // const [datasCompletasSemana, setDatasCompletasSemana] = useState<Date[]>([]); // Removido - não utilizado
  // const [debugInfo, setDebugInfo] = useState<string[]>([]); // Removido - não utilizado

  // Função para calcular as datas da semana atual (SEMPRE EM UTC)
  const calcularDatasSemanaAtual = (): [string[], Date[]] => {
    const hojeUTC = new Date(); // Data atual
    const diaSemanaHojeUTC = hojeUTC.getUTCDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado (em UTC)
    
    // Calcula o timestamp da segunda-feira desta semana em UTC
    // Se hoje é domingo (0), recua 6 dias. Senão, recua (diaSemanaHojeUTC - 1) dias.
    const diffSegunda = diaSemanaHojeUTC === 0 ? -6 : -(diaSemanaHojeUTC - 1);
    const segundaFeiraTimestamp = Date.UTC(hojeUTC.getUTCFullYear(), hojeUTC.getUTCMonth(), hojeUTC.getUTCDate() + diffSegunda);
    
    const datasFormatadas: string[] = [];
    const datasCompletas: Date[] = [];
    
    // Gera as datas para cada dia da semana (segunda a sábado) em UTC
    for (let i = 0; i < 6; i++) {
      // Calcula o timestamp do dia atual do loop em UTC
      const diaTimestamp = segundaFeiraTimestamp + i * 24 * 60 * 60 * 1000;
      const data = new Date(diaTimestamp); // Cria objeto Date a partir do timestamp UTC
      
      // Salva a data completa (já está em UTC)
      datasCompletas.push(data);
      
      // Formata a data como DD/MM usando métodos UTC
      datasFormatadas.push(formatarDataDDMM(data));
    }
    
    return [datasFormatadas, datasCompletas];
  };

  // Função para calcular o número da semana (SEMPRE EM UTC)
  const calcularNumeroSemana = (data: Date): number => {
    // Cria uma cópia da data em UTC
    const dataUTC = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
    
    // Define para o primeiro dia do ano em UTC
    const primeiroDiaAnoUTC = new Date(Date.UTC(dataUTC.getUTCFullYear(), 0, 1));
    
    // Calcula o número de dias desde o primeiro dia do ano
    const diasDesdeInicio = Math.floor((dataUTC.getTime() - primeiroDiaAnoUTC.getTime()) / (24 * 60 * 60 * 1000));
    
    // Calcula o número da semana (ISO 8601 week date system logic might be more robust, but this is a common simple method)
    // getUTCDay() retorna 0 para Domingo, 1 para Segunda... 6 para Sábado
    // Adiciona o dia da semana do primeiro dia do ano (0-6) para alinhar com a semana
    return Math.ceil((diasDesdeInicio + primeiroDiaAnoUTC.getUTCDay() + 1) / 7);
  };

  // Função para verificar se uma data (formato DD/MM) já passou (SEMPRE EM UTC)
  const verificarDataPassada = (dataStr: string): boolean => {
    // Obtém a data atual em UTC, zerando as horas
    const hojeUTC = new Date();
    hojeUTC.setUTCHours(0, 0, 0, 0);
    
    // Converte a data do formato DD/MM para um objeto Date UTC
    // Assume o mesmo ano da data atual (em UTC)
    const [dia, mes] = dataStr.split("/").map(Number);
    const anoAtualUTC = hojeUTC.getUTCFullYear();
    const dataCompararTimestamp = Date.UTC(anoAtualUTC, mes - 1, dia);
    const dataCompararUTC = new Date(dataCompararTimestamp);
    
    // Retorna true se a data já passou (comparando timestamps UTC)
    return dataCompararUTC.getTime() < hojeUTC.getTime();
  };

  // Função para verificar se um pedido específico já passou (data anterior a hoje)
  const verificarPedidoPassado = (dataStr: string): boolean => {
    // Obtém a data atual em UTC, zerando as horas
    const hojeUTC = new Date();
    hojeUTC.setUTCHours(0, 0, 0, 0);
    
    // Converte a data do pedido (formato YYYY-MM-DD) para um objeto Date UTC
    const dataPedidoUTC = new Date(dataStr.split("T")[0] + "T00:00:00Z");
    
    // Retorna true se a data do pedido for estritamente anterior a hoje (em UTC)
    return dataPedidoUTC < hojeUTC;
  };

  // Função para somar os bolos por tipo
  const somarBolosPorTipo = (pedidos: PedidoProcessado[]): BoloSomado[] => {
    // Inicializa o objeto de soma
    const somaPorTipo: {[key: string]: BoloSomado} = {};
    
    // Para cada pedido
    pedidos.forEach(pedido => {
      // Para cada bolo no pedido
      pedido.bolos.forEach(bolo => {
        const tipoBase = bolo.tipo;
        
        // Se o tipo de bolo ainda não existe no objeto de soma, inicializa
        if (!somaPorTipo[tipoBase]) {
          somaPorTipo[tipoBase] = {
            tipo: tipoBase,
            abreviacao: bolo.abreviacao.split(' ')[0], // Pega só a parte do tipo (PDM, CHOCO, etc)
            cor: bolo.cor,
            pequeno: 0,
            grande: 0
          };
        }
        
        // Verifica se é pequeno ou grande e incrementa o contador apropriado
        if (bolo.tamanho === 'pequeno') {
          somaPorTipo[tipoBase].pequeno += bolo.quantidade;
        } else if (bolo.tamanho === 'grande') {
          somaPorTipo[tipoBase].grande += bolo.quantidade;
        }
      });
    });
    
    // Converte o objeto em array
    return Object.values(somaPorTipo);
  };

  // Função para processar os dados da API e organizá-los por dia da semana
  const processarDados = (pedidos: Pedido[]): PedidosPorDia => {
    const resultado: PedidosPorDia = {};
    const logs: string[] = [];
    
    // Calcula as datas da semana atual
    const [datasAtual, datasCompletas] = calcularDatasSemanaAtual();
    setDatasSemanaAtual(datasAtual);
    setDatasCompletasSemana(datasCompletas);
    
    // Inicializa todos os dias da semana com as datas da semana atual
    diasSemana.forEach((dia, index) => {
      resultado[dia] = {
        pedidos: [],
        somatorio: [],
        data: datasAtual[index],
        passado: verificarDataPassada(datasAtual[index]) // Verifica se o dia já passou
      };
    });
    
    // Calcula e atualiza o número da semana com base na data atual (sempre que processar)
    setNumeroSemana(calcularNumeroSemana(new Date()));
    
    // Processa cada pedido
    pedidos.forEach(pedido => {
      // Verifica se tem data de entrega e cliente
      if (pedido.property_data_entrega && pedido.property_data_entrega.start && pedido.property_cliente) {
        // Obtém a data do pedido
        const dataPedidoISO = pedido.property_data_entrega.start;
        
        // Converte a data ISO para um objeto Date, garantindo que seja UTC
        const dataPedido = new Date(dataPedidoISO.split("T")[0] + "T00:00:00Z");
        // dataPedido.setHours(0, 0, 0, 0); // Não é mais necessário zerar horas com UTC
        
        // Obtém o dia da semana UTC (0 = domingo, 1 = segunda, ..., 6 = sábado)
        const diaSemanaNum = dataPedido.getUTCDay();
        
        // Domingo (0) não é exibido na aplicação, então ignoramos
        if (diaSemanaNum === 0) {
          logs.push(`Pedido: ${pedido.property_cliente}, Data: ${dataPedidoISO}, Ignorado: é domingo`);
          return;
        }

        logs.push(`Pedido: ${pedido.property_cliente}, Data ISO: ${dataPedidoISO}`);
        logs.push(`  -> Data Pedido Obj: ${dataPedido.toISOString()} (UTC) | ${dataPedido.toString()} (Local)`);
        logs.push(`  -> Dia Semana Num (getDay): ${diaSemanaNum}`);
        
        // Verifica se a data do pedido está na semana atual
        let estaNaSemanaAtual = false;
        let indiceDia = -1;
        
        logs.push(`  -> Comparando com datas da semana atual [${datasCompletas.map(d => d.toISOString().split("T")[0]).join(", ")}]:`);
        // Compara a data do pedido com cada data da semana atual
        for (let i = 0; i < datasCompletas.length; i++) {
          const dataCompleta = datasCompletas[i];
          logs.push(`    - Iteração ${i}: Comparando ${dataPedido.toISOString().split("T")[0]} com ${dataCompleta.toISOString().split("T")[0]}`);
          
          const match = 
            dataPedido.getUTCFullYear() === dataCompleta.getUTCFullYear() &&
            dataPedido.getUTCMonth() === dataCompleta.getUTCMonth() &&
            dataPedido.getUTCDate() === dataCompleta.getUTCDate();
            
          logs.push(`      -> Anos UTC: ${dataPedido.getUTCFullYear()} vs ${dataCompleta.getUTCFullYear()} (${dataPedido.getUTCFullYear() === dataCompleta.getUTCFullYear()})`);
          logs.push(`      -> Meses UTC: ${dataPedido.getUTCMonth()} vs ${dataCompleta.getUTCMonth()} (${dataPedido.getUTCMonth() === dataCompleta.getUTCMonth()})`);
          logs.push(`      -> Dias UTC: ${dataPedido.getUTCDate()} vs ${dataCompleta.getUTCDate()} (${dataPedido.getUTCDate() === dataCompleta.getUTCDate()})`);
          logs.push(`      -> Match: ${match}`);

          // Compara ano, mês e dia
          if (match) {
            estaNaSemanaAtual = true;
            indiceDia = i;
            logs.push(`      -> ENCONTRADO! Índice: ${indiceDia}`);
            break;
          }
        }
        
        // Se não está na semana atual, ignora o pedido
        if (!estaNaSemanaAtual) {
          logs.push(`  -> Ignorado: data fora da semana atual`);
          return;
        }
        
        // Formata a data do pedido como DD/MM para exibição
        const dataPedidoFormatada = formatarDataDDMM(dataPedido);
        
        // Obtém o dia da semana correspondente ao índice
        const diaSemana = diasSemana[indiceDia];
        logs.push(`  -> Dia da semana final atribuído: ${diaSemana} (índice ${indiceDia})`);
        
        // Lista de bolos pedidos
        const bolosPedidos: {
          tipo: string;
          quantidade: number;
          abreviacao: string;
          cor: string;
          tamanho: string;
        }[] = [];
        
        // Verifica cada tipo de bolo no pedido
        propriedadesBolos.forEach(prop => {
          // Se o pedido tem esse tipo de bolo (valor > 0), adiciona à lista
          if (pedido[prop] && pedido[prop] > 0) {
            const infoBolo = nomesBolos[prop];
            bolosPedidos.push({
              tipo: infoBolo.tipoBase,
              quantidade: pedido[prop] as number,
              abreviacao: infoBolo.abreviacao,
              cor: infoBolo.cor,
              tamanho: infoBolo.tamanho
            });
          }
        });
        
        // Adiciona o pedido processado ao dia correspondente
        if (bolosPedidos.length > 0) {
          resultado[diaSemana].pedidos.push({
            cliente: pedido.property_cliente,
            bolos: bolosPedidos,
            dataOriginal: dataPedidoISO,
            dataFormatada: dataPedidoFormatada
          });
          logs.push(`  - Adicionado ao dia: ${diaSemana} (${datasAtual[indiceDia]})`);
        }
      }
    }); // Fim do pedidos.forEach
    
    // Calcula o somatório de bolos para cada dia
    Object.keys(resultado).forEach(dia => {
      resultado[dia].somatorio = somarBolosPorTipo(resultado[dia].pedidos);
    });
    
    // Atualiza as informações de depuração
    setDebugInfo(logs);
    
    return resultado;
  }; // Fim do processarDados

  // Função para buscar os dados da API
  const buscarPedidos = async () => {
    setCarregando(true);
    setErro(null);
    
    try {
      // Adiciona um parâmetro de versão para evitar cache
      const resposta = await fetch(`https://n8n.gabrielpicanco.site/webhook/bolos-semana?v=${APP_VERSION}`);
      
      if (!resposta.ok) {
        throw new Error(`Erro ao buscar dados: ${resposta.status}`);
      }
      
      const dados = await resposta.json();
      
      // Processa os dados para organizar por dia da semana
      const pedidosProcessados = processarDados(dados);
      setPedidosPorDia(pedidosProcessados);
      
      // Atualiza a hora da última atualização
      const agora = new Date();
      setUltimaAtualizacao(
        `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`
      );
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setErro('Não foi possível carregar os pedidos. Por favor, tente novamente mais tarde.');
    } finally {
      setCarregando(false);
    }
  };

  // Busca os dados quando o componente é montado
  useEffect(() => {
    buscarPedidos();

    // Configura atualização automática a cada 5 minutos se estiver ativada
    let intervalo: number | undefined;
    
    if (atualizacaoAutomatica) {
      intervalo = window.setInterval(() => {
        buscarPedidos();
      }, 5 * 60 * 1000); // 5 minutos
    }

    // Limpa o intervalo quando o componente é desmontado
    return () => {
      if (intervalo) {
        clearInterval(intervalo);
      }
    };
  }, [atualizacaoAutomatica]);

  // Alterna a atualização automática
  const alternarAtualizacaoAutomatica = () => {
    setAtualizacaoAutomatica(!atualizacaoAutomatica);
  };

  // Função para forçar a atualização dos pedidos
  const forcarAtualizacao = () => {
    buscarPedidos();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-amber-800 mb-2">
          Bolos da Semana {numeroSemana > 0 ? numeroSemana : ''}
        </h1>
        <p className="text-gray-600">
          Confira os pedidos de bolos para cada dia da semana
        </p>
      </header>

      <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <p className="text-sm text-gray-500">
            {ultimaAtualizacao ? `Última atualização: ${ultimaAtualizacao}` : ''}
          </p>
          <div className="flex items-center mt-2">
            <label className="inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={atualizacaoAutomatica} 
                onChange={alternarAtualizacaoAutomatica} 
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">Atualização automática</span>
            </label>
          </div>
        </div>
        <button 
          onClick={forcarAtualizacao}
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300 flex items-center"
          disabled={carregando}
        >
          {carregando ? 'Atualizando...' : 'Atualizar Pedidos'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{erro}</p>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Carregando pedidos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {diasSemana.map((dia, index) => (
            <div key={dia} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className={`p-4 ${pedidosPorDia[dia]?.passado ? 'bg-gray-500' : 'bg-amber-500'} text-white`}>
                <h2 className="text-xl font-semibold">{diasSemanaFormatados[index]} - {pedidosPorDia[dia]?.data}</h2>
              </div>
              <div className="p-4">
                {pedidosPorDia[dia]?.pedidos.length > 0 ? (
                  <>
                    {/* Tabela de somatório */}
                    {pedidosPorDia[dia]?.somatorio.length > 0 && (
                      <div className="mb-4 overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-700 mb-2">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                              <th scope="col" className="px-4 py-2">TIPO</th>
                              <th scope="col" className="px-4 py-2 text-center">P</th>
                              <th scope="col" className="px-4 py-2 text-center">G</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pedidosPorDia[dia]?.somatorio.map((bolo, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="px-4 py-2 font-medium" style={{ color: bolo.cor }}>{bolo.abreviacao}</td>
                                <td className="px-4 py-2 text-center">{bolo.pequeno > 0 ? bolo.pequeno : '-'}</td>
                                <td className="px-4 py-2 text-center">{bolo.grande > 0 ? bolo.grande : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {/* Lista de pedidos */}
                    <div className="space-y-2">
                      {pedidosPorDia[dia]?.pedidos.map((pedido, idx) => {
                        const pedidoPassado = verificarPedidoPassado(pedido.dataOriginal);
                        
                        return (
                          <div key={idx} className={`py-2 ${idx !== 0 ? 'border-t border-gray-100' : ''}`}>
                            <p className={`font-medium ${pedidoPassado ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                              {pedido.cliente}
                            </p>
                            <div className="mt-1">
                              {pedido.bolos.map((bolo, boloIdx) => (
                                <p 
                                  key={boloIdx} 
                                  className={`text-sm ${pedidoPassado ? 'line-through opacity-70' : ''}`} 
                                  style={{ color: pedidoPassado ? '#888888' : bolo.cor }}
                                >
                                  {bolo.quantidade} x {bolo.abreviacao}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 py-4 text-center">Não há pedidos para este dia.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}



      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>Os bolos são preparados com ingredientes frescos e de alta qualidade. A disponibilidade pode variar conforme a demanda.</p>
        <p className="mt-2">Para mais informações ou encomendas especiais, entre em contato conosco.</p>
        <p className="mt-2 text-xs">Versão: {APP_VERSION}</p>
      </footer>
    </div>
  )
}

export default App
