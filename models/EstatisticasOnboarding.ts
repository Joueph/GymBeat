import { FieldValue } from 'firebase/firestore';

/**
 * @interface EstatisticasOnboarding
 * Define a estrutura de dados para coletar as estatísticas
 * e respostas do usuário durante o fluxo de onboarding (25 steps).
 *
 * Este documento deve ser criado no início do onboarding e atualizado
 * a cada passo concluído pelo usuário.
 */
export interface EstatisticasOnboarding {
  // --- Metadados Ocultos (Tracking) ---

  /**
   * Horário exato (timestamp) de quando o usuário
   * iniciou o fluxo de onboarding (primeira tela).
   */
  horarioInicioOnboarding: Date | FieldValue | null;

  /**
   * Horário exato (timestamp) de quando o usuário
   * finalizou o onboarding e a conta foi efetivamente criada.
   */
  horarioRegistro: Date | FieldValue | null;

  // --- Respostas das Perguntas do Onboarding ---

  /**
   * Pergunta: Onde você ouviu falar da GymBeat?
   * (Ex: "App Store", "Amigo", "Instagram")
   */
  ondeOuviuGymBeat: string | null;

  /**
   * Pergunta: Você já tentou outros apps de treino antes?
   * (Ex: "Sim", "Não", "Alguns")
   */
  tentouOutrosApps: string | null;

  /**
   * Pergunta: Qual seu objetivo principal?
   * (Ex: "Perder peso", "Ganhar massa", "Manter a saúde")
   */
  objetivoPrincipal: string | null;

  /**
   * Pergunta: O que você considera que seja seu maior problema para treinar?
   * (Ex: "Falta de tempo", "Falta de motivação")
   */
  maiorProblemaTreinar: string | null;

  /**
   * Pergunta: O que você considera que seja seu maior problema para treinar? (Multi-seleção)
   * (Ex: ["Falta de motivação", "Falta de constância"])
   */
  problemasParaTreinar?: string[] | null;

  /**
   * Pergunta: Onde você costuma treinar?
   * (Ex: "Academia", "Casa", "Ambos")
   */
  localTreino: string | null;

  /**
   * Pergunta: Você possui halteres e pesos livres em casa?
   */
  possuiEquipamentosCasa: boolean | null;

  /**
   * Pergunta: Como você se considera em relação à {academia}{Exercícios físicos}?
   * (Ex: "Iniciante", "Intermediário", "Avançado")
   */
  nivelExperiencia: string | null;

  /**
   * Pergunta: Quantas vezes você se compromete à ir para a academia por semana?
   */
  compromissoSemanal: number | null;

  /**
   * Pergunta: Vamos manter uma meta de semanas!
   */
  metaSemanas: number | null;

  /**
   * Pergunta: Como podemos te chamar? (Nome de preferência)
   */
  nomePreferido: string | null; // This was already here, the error was in registro.tsx using 'comoPodemosTeChamar'

  /**
   * Pergunta: Qual o seu gênero?
   * (Ex: "Masculino", "Feminino", "Outro", "Prefiro não dizer")
   */
  genero: string | null;

  /**
   * Pergunta: Qual sua altura?
   * (Recomendado armazenar em centímetros para facilitar cálculos)
   */
  alturaCm: number | null;

  /**
   * Pergunta: Qual seu peso?
   * (Recomendado armazenar em Kg)
   */
  pesoKg: number | null;

  /**
   * Pergunta: Qual sua data de nascimento?
   */
  dataNascimento: Date | string | null; // String se armazenar como ISO, Date se for Timestamp

  /**
   * Pergunta: Vamos colocar uma foto de perfil?
   * (Controla se o usuário realizou a ação de adicionar a foto
   * durante o onboarding, não a URL da foto em si)
   */
  adicionouFotoPerfil: boolean | null;

  /**
   * NOTA: Você pode adicionar mais campos aqui para os outros
   * 25 steps, se eles coletarem dados que não estão listados acima.
   */

  /**
   * Pergunta: Você já possui uma ficha de treino?
   */
  possuiFicha?: boolean | null;

  /**
   * Pergunta: Deseja receber uma ficha recomendada?
   */
  desejaFichaRecomendada?: boolean | null;

  /**
    * O usuário aceitou a ficha recomendada?
    */
  acceptedFicha?: boolean;

  /**
   * A ficha que foi recomendada para o usuário.
   */
  recommendedFicha?: any; // FichaModelo

  recommendedTreinos?: any[]; // TreinoModelo[]
}
