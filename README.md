# Sistema Provoleta Pizzaria

## Visão Geral

Sistema Provoleta é uma aplicação SPA local para gestão de pizzaria delivery. O painel administrativo roda com HTML5, CSS modular, JavaScript Vanilla ES Modules e salva dados no LocalStorage do navegador.

O sistema foi projetado para operação interna simples, com: pedidos, cadastros, fluxo de caixa, estoque, motoboys, dashboards e backup. Também fornece uma página pública de pedidos para clientes, alimentada por `cardapio_publico.json`.

---

## Novas Implementações

### 1. Kanban de Pedidos e edição de status
- O painel de `Pedidos` agora exibe um Kanban com colunas de `Pendente`, `Em preparo`, `Entregue` e `Cancelado`.
- Ao alterar status por botão ou arrastar um card, o pedido é salvo imediatamente no LocalStorage correspondente a `provoleta_pedidos_YYYY_MM`.
- A re-renderização do Kanban é feita de forma limpa, evitando duplicação de cards.
- O `meta.referenceMonth` é utilizado para garantir que o pedido alterado seja persistido no mês de referência atual.

### 2. Fracionamento Automático de Pizzas
- O formulário de pedido divide automaticamente o preço da pizza entre sabores quando existem múltiplos sabores, suportando até 4 sabores por pizza.
- O cálculo de preço respeita o tamanho escolhido e a quantidade de sabores, mantendo a proporcionalidade correta.

### 3. Validação inteligente de Bebidas
- O formulário exige seleção de bebida e tamanho juntos antes de adicionar o item ao pedido.
- Se a bebida não estiver completa (sem tamanho ou sem bebida selecionada), o sistema não permite confirmar o item.

### 4. Campos dinâmicos por modo de entrega
- O formulário oculta `Bairro`, `Taxa de entrega` e `Motoboy` quando o modo de pedido é `Retirada` (pickup).
- Esses campos reaparecem automaticamente para `Entrega` (delivery).
- Isso evita sobreposição de dados e reduz erros de preenchimento.

### 5. Fluxo de Caixa reativo
- Quando um pedido muda de status para `cancelado`, ele é excluído do cálculo de faturamento bruto do mês.
- O módulo de `Fluxo de Caixa` é atualizado automaticamente ao guardar o novo status.

---

## Estrutura do Projeto

```text
Sistema Provoleta/
├── index.html
├── pedido.html
├── cardapio_publico.json
├── assets/
├── css/
│   ├── components.css
│   ├── layout.css
│   ├── pages.css
│   ├── pedido.css
│   └── variables.css
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── pedido.js
│   ├── public-menu.js
│   ├── seed.js
│   ├── storage.js
│   ├── ui.js
│   ├── utils.js
│   └── modules/
│       ├── backup.js
│       ├── cashflow.js
│       ├── config.js
│       ├── dashboard.js
│       ├── inventory.js
│       ├── motoboys.js
│       └── orders.js
```

---

## Como Rodar Localmente

Abra `index.html` diretamente ou execute um servidor local para evitar problemas de `fetch` com o JSON público:

```bash
python -m http.server 8000
```

Acesse: `http://127.0.0.1:8000/index.html` e `http://127.0.0.1:8000/pedido.html`.

---

## Como Funciona o Painel Administrativo

- `index.html`: interface do painel, sidebar, overlay de login, modal e área principal.
- `js/app.js`: inicializa o app, controla navegação e autenticação.
- `js/storage.js`: salva e lê LocalStorage, incluindo pedidos mensais e caixa mensal.
- `js/modules/orders.js`: gerencia a criação, edição, filtro e Kanban de pedidos.
- `js/modules/cashflow.js`: exibe receita + despesas e recalcula saldo.
- `js/ui.js`: modal, toast, paginação e estado vazio.
- `js/utils.js`: funções auxiliares para datas, moeda, rótulos e parsing.

---

## Debug LocalStorage e Resolução de Problemas

### Verificando chaves de pedido no Console
Se precisar validar pedidos de um mês, abra o DevTools e rode:

```js
const month = '2024-12'; // troque para o mês desejado
const key = `provoleta_pedidos_${month.replace('-', '_')}`;
console.log(key, localStorage.getItem(key));
const orders = JSON.parse(localStorage.getItem(key) || '[]');
console.table(orders, ['id','orderNumber','datetime','status','total','customerName']);
```

### Verificando referência de mês
```js
console.log(JSON.parse(localStorage.getItem('provoleta_meta') || '{}'));
```

### Verificando caixa mensal
```js
const cashKey = `provoleta_caixa_${month.replace('-', '_')}`;
console.log(cashKey, localStorage.getItem(cashKey));
```

### Para debugar falhas de UI
- Verifique se o modal está visível e se a camada de overlay está no topo.
- Garanta que o `modal-overlay` esteja com `display: flex` e `z-index` mais alto que outros elementos.

---

## Manutenção de Estilos e z-index

O sistema agora usa variáveis de z-index padronizadas em `css/variables.css`:

- `--z-dropdown: 100`
- `--z-fixed: 500`
- `--z-modal-overlay: 1000`
- `--z-modal: 1010`
- `--z-toast: 2000`

Use essas variáveis para garantir que modais e overlays sempre fiquem acima de menus fixos e componentes flutuantes.

### Regras de layout aplicadas
- Containers principais usam `min-height: 0` para permitir que grids e flexboxes encolham corretamente.
- Painéis `main-wrapper` e `main-content` agora evitam overflow inesperado.
- Colunas do Kanban têm `overflow-y: auto` para evitar vazamento de conteúdo e manter a grade intacta.
- O modal tem fundo opaco e a área de corpo limita a altura para não invadir o formulário subjacente.

---

## Recursos e funcionalidades

- Cadastro de sabores, bebidas, canais, motoboys, bairros e adicionais.
- Lançamento de pedidos com edição completa em modal.
- Kanban de pedidos com drag-and-drop e alteração de status.
- Exportação CSV/JSON de pedidos filtrados.
- Fluxo de Caixa com receitas automáticas e despesas manuais.
- Painel de dashboards com gráficos e indicadores.
- Backup e exportação do cardápio público.

---

## Observação Final

O sistema foi ajustado para operação local robusta. Em caso de regressões visuais, revise primeiro as variáveis de `z-index` e os contêineres principais, depois verifique se a chave correta do mês está sendo usada para salvar pedidos no LocalStorage.
