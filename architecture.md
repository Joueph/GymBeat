# Arquitetura React Native (Expo)

## Visão Geral
Esta arquitetura é **válida, escalável e modular** para apps em React Native com Expo, desde que haja **separação clara de responsabilidades** entre camadas.

---

## Estrutura Recomendada
```
src/
 ├─ views/        # Telas (orquestração)
 ├─ components/   # UI reutilizável
 ├─ hooks/        # Lógica de estado e negócio
 ├─ services/     # API, storage, integrações externas
 ├─ utils/        # Funções puras e reutilizáveis
 └─ types/        # Tipagens compartilhadas
```

---

## Responsabilidades

### Views
- Orquestram a tela
- Chamam hooks
- Renderizam componentes
- ❌ Não implementam regra de negócio

### Components
- Apenas UI (cards, botões, layouts)
- Recebem dados via props
- Podem usar hooks de UI (animações, layout)
- ❌ Não contêm lógica de negócio

### Hooks
- Concentram lógica de negócio
- Gerenciam estado
- Coordenam chamadas aos services

### Services
- Comunicação externa (API, Firebase, AsyncStorage)
- ❌ Não dependem de React

### Utils
- Funções puras
- Totalmente independentes do app e do React

---

## Boas Práticas
- Views devem ser **finas**
- Lógica deve viver em **hooks**
- Helpers não devem ficar em `components`
- Services facilitam troca de backend

---

## Benefícios
- Alta reutilização de código
- Facilidade de manutenção
- Escala bem para apps médios e grandes
- Testabilidade aprimorada

---

## Veredito
A arquitetura é sólida e recomendada. Com a separação correta entre Views, Components, Hooks, Services e Utils, o projeto se mantém organizado, modular e pronto para escalar.

