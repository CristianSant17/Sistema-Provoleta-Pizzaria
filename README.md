# Sistema Provoleta Pizzaria

## Visão geral

O Sistema Provoleta é uma solução web local, pensada para gerir o dia a dia de uma pizzaria delivery com foco em simplicidade, rapidez e operação sem backend. Ele combina HTML, CSS e JavaScript puro com módulos ES modules, persistência em LocalStorage e uma página pública para clientes montarem pedidos e enviarem pelo WhatsApp.

O projeto possui dois fluxos principais:

- Fluxo administrativo: painel interno para cadastrar cardápio, pedidos, custos, motoboys, estoque, dashboards e backups.
- Fluxo público: página de pedidos para clientes, que consome um cardápio publicado em JSON e gera uma mensagem pronta para o WhatsApp da loja.

---

## Objetivo do sistema

O sistema foi criado para centralizar as operações básicas de uma pizzaria delivery, incluindo:

- cadastro e manutenção do cardápio;
- lançamento e acompanhamento de pedidos;
- controle financeiro mensal com receitas e despesas;
- acompanhamento de motoboys;
- gestão de estoque;
- visualização de indicadores e gráficos;
- exportação de backup e publicação do cardápio público.

---

## Arquitetura geral

### Stack utilizada

- HTML5 para estrutura das telas;
- CSS modularizado em arquivos separados por responsabilidade;
- JavaScript ES modules para organização da lógica;
- LocalStorage do navegador para persistência local;
- Chart.js para gráficos do dashboard;
- Sem backend, sem banco de dados e sem sincronização entre dispositivos.

### Modelo de execução

A aplicação funciona como uma SPA simples, onde o painel administrativo carrega diferentes módulos conforme o usuário navega entre as telas. Tudo é renderizado no navegador e os dados ficam armazenados localmente no dispositivo em que a aplicação foi aberta.

---

## Estrutura do projeto

```text
Sistema Provoleta/
├── index.html                # painel administrativo principal
├── pedido.html               # página pública de pedidos para clientes
├── cardapio_publico.json     # cardápio público exportado para clientes
├── assets/                   # imagens e recursos estáticos
├── css/                      # estilos organizados por responsabilidade
│   ├── components.css
│   ├── layout.css
│   ├── pages.css
│   ├── pedido.css
│   └── variables.css
├── js/                       # lógica da aplicação
│   ├── app.js                # bootstrap principal, autenticação e navegação
│   ├── constants.js          # constantes globais do sistema
│   ├── pedido.js             # lógica da página pública de pedidos
│   ├── public-menu.js       # construção e normalização do JSON público
│   ├── seed.js               # dados iniciais de exemplo
│   ├── storage.js            # camada de persistência LocalStorage
│   ├── ui.js                 # utilitários de modal, toast, tabs e paginação
│   ├── utils.js              # funções auxiliares gerais
│   └── modules/              # módulos principais da gestão
│       ├── backup.js
│       ├── cashflow.js
│       ├── config.js
│       ├── dashboard.js
│       ├── inventory.js
│       ├── motoboys.js
│       └── orders.js
```

---

## Arquivos principais e responsabilidades

| Arquivo | Função |
|---|---|
| index.html | Estrutura do painel administrativo, incluindo sidebar, header, conteúdo principal, overlay de autenticação e containers globais. |
| pedido.html | Estrutura da página pública para clientes montarem o pedido. |
| cardapio_publico.json | Arquivo JSON usado pela página pública para montar o cardápio. |
| js/app.js | Inicializa a aplicação, controla a navegação entre páginas e gerencia a autenticação administrativa. |
| js/storage.js | Centraliza a persistência em LocalStorage: configurações, cadastros, pedidos, caixa, estoque e meta. |
| js/constants.js | Define constantes como número WhatsApp padrão, nome do arquivo JSON público e estrutura base do cardápio. |
| js/seed.js | Cria dados iniciais de exemplo no primeiro uso. |
| js/utils.js | Contém funções utilitárias para moeda, datas, IDs, links WhatsApp e escape de HTML. |
| js/public-menu.js | Converte os cadastros internos em um cardápio público compatível com o JSON usado pela página pública. |
| js/pedido.js | Implementa a experiência do cliente: cardápio, sacola, seleção de bairro, extras e envio por WhatsApp. |
| js/ui.js | Reúne helpers para mensagens, modal, abas e paginação. |
| js/modules/orders.js | Módulo de lançamento, edição, exclusão, filtros e status de pedidos. |
| js/modules/config.js | Módulo de cadastros de categorias, sabores, bebidas, bairros, motoboys, canais e adicionais. |
| js/modules/cashflow.js | Módulo de fluxo de caixa com receitas automáticas e despesas manuais. |
| js/modules/motoboys.js | Módulo de relatório e acerto com motoboys. |
| js/modules/inventory.js | Módulo de controle de estoque, entradas e saídas. |
| js/modules/dashboard.js | Módulo de dashboards com gráficos e indicadores. |
| js/modules/backup.js | Módulo de exportação de backup e publicação do cardápio público. |

---

## Fluxo de uso do sistema

### 1. Inicialização

Ao abrir o painel administrativo em index.html, a aplicação:

- executa a inicialização de dados;
- verifica se há conteúdo já registrado;
- se não houver, cria uma base de exemplo com:
  - categorias de pizza;
    - sabores iniciais;
      - bebidas exemplares;
        - bairros e taxas de entrega;
          - motoboy inicial;
            - canais de venda;
              - itens básicos de estoque.

              ### 2. Navegação interna

              A navegação do painel é feita por botões laterais da sidebar e o conteúdo principal é renderizado dinamicamente conforme a página selecionada:

              - Pedidos
              - Cadastros
              - Fluxo de Caixa
              - Acerto Motoboys
              - Estoque
              - Dashboards
              - Backup / Publicar

              ### 3. Seletor de mês

              O sistema possui um seletor de mês no topo do painel. Esse valor define o contexto de análise para pedidos, caixa, motoboys e dashboards. O valor escolhido é salvo em meta.referenceMonth e reaproveitado na próxima execução.

              ---

              ## Autenticação administrativa

              O painel administrativo possui uma proteção simples por senha para evitar acesso indevido.

              - senha padrão: JCProvoleta
              - a autenticação é realizada em sessão via sessionStorage
              - ao sair, o sistema bloqueia novamente o acesso

              > Esse modelo é suficiente para uso local e simples, mas não substitui um backend com autenticação real e controle de usuários.

              ---

              ## Persistência de dados

              ### Estratégia

              Todos os dados do sistema são armazenados no LocalStorage do navegador. Não existe banco de dados, backend ou sincronização entre dispositivos.

              ### Prefixo das chaves

              As chaves salvas no LocalStorage usam o prefixo provoleta_.

              ### Tipos de dados persistidos

              - configurações gerais do sistema;
              - cadastros do cardápio e logística;
              - pedidos por mês/ano;
              - fluxo de caixa por mês/ano;
              - estoque global;
              - meta do sistema (mês de referência, contadores de pedidos e flag de inicialização);
              - preferências da loja para a página pública.

              ### Estrutura de armazenamento

              - pedidos mensais: provoleta_pedidos_YYYY_MM
              - caixa mensal: provoleta_caixa_YYYY_MM
              - cadastros gerais: provoleta_config
              - estoque: provoleta_estoque
              - meta: provoleta_meta
              - preferências: provoleta_settings
              - snapshot do cardápio público: provoleta_public_menu

              ### Observação importante

              Como os dados ficam no navegador, qualquer limpeza do LocalStorage, uso em modo anônimo, troca de navegador ou uso em outro computador fará o sistema parecer vazio. Por isso, o módulo de backup é essencial.

              ---

              ## Módulo de pedidos

              ### Funcionalidades

              O módulo de pedidos permite:

              - lançar novo pedido;
              - editar pedido existente;
              - excluir pedido;
              - marcar pedido como entregue;
              - filtrar por status, motoboy e forma de pagamento;
              - navegar entre páginas de pedidos;
              - visualizar o faturamento do mês.

              ### Campos de um pedido

              Cada pedido contém:

              - número do pedido;
              - data e hora;
              - tipo (pizza ou bebida);
              - item (sabor ou bebida);
              - tamanho;
              - quantidade;
              - valor unitário;
              - bairro;
              - taxa de entrega;
              - canal de venda;
              - motoboy;
              - forma de pagamento;
              - observações;
              - total;
              - status.

              ### Regras de negócio principais

              - O valor total do pedido é calculado como: quantidade × valor unitário + taxa de entrega.
              - O número do pedido é sequencial por mês, controlado em meta.orderCounters.
              - Pedidos cancelados não entram no cálculo de faturamento.
              - O faturamento do mês é somado automaticamente a partir dos pedidos válidos.

              ---

              ## Módulo de cadastros

              ### O que pode ser cadastrado

              No módulo de cadastros o usuário controla:

              - categorias de pizza;
              - sabores de pizza;
              - bebidas;
              - bairros e taxas de entrega;
              - motoboys;
              - canais de venda;
              - adicionais e extras opcionais.

              ### Como isso impacta o sistema

              Esses cadastros alimentam:

              - o formulário de pedidos no painel administrativo;
              - a página pública de pedidos;
              - o cardápio público exportado em JSON;
              - os relatórios e dashboards.

              ---

              ## Módulo de fluxo de caixa

              ### Funcionalidades

              O fluxo de caixa permite:

              - visualizar receitas automáticas a partir dos pedidos do mês;
              - lançar despesas manualmente;
              - editar despesas;
              - excluir despesas;
              - calcular saldo líquido do mês.

              ### Regras de negócio principais

              - As entradas vêm automaticamente dos pedidos do mês selecionado.
              - As saídas são cadastradas manualmente pelo gestor.
              - O saldo é calculado como receita - despesas.

              ### Categorias de despesas utilizadas

              As despesas aceitam categorias como:

              - Compra de Insumos;
              - Diária de Motoboy;
              - Energia;
              - Aluguel;
              - Embalagens;
              - Marketing;
              - Outros.

              ---

              ## Módulo de motoboys

              ### Objetivo

              Fornecer um relatório de entregas por motoboy e facilitar o fechamento de caixa.

              ### Funcionalidades

              - selecionar motoboy;
              - filtrar por dia ou por todo o mês;
              - visualizar entregas, taxas e valores;
              - calcular se o dinheiro recebido bate com o valor esperado em pedidos pagos em dinheiro.

              ---

              ## Módulo de estoque

              ### Objetivo

              Acompanhar itens de estoque como:

              - mussarela;
              - embalagens;
              - sacolas;
              - outros insumos.

              ### Funcionalidades

              - cadastrar itens com unidade, estoque inicial e estoque mínimo;
              - registrar entradas;
              - registrar saídas;
              - editar itens;
              - excluir itens;
              - visualizar estoque atual;
              - destacar itens abaixo do mínimo.

              ### Fórmula de cálculo

              Estoque atual = estoque inicial + entradas - saídas.

              Se o estoque atual for menor ou igual ao estoque mínimo, o item é marcado como alerta para recomprar.

              ---

              ## Módulo de dashboards

              ### Objetivo

              Mostrar indicadores e gráficos para apoiar decisões do gestor.

              ### Visões disponíveis

              - visão do mês selecionado;
              - visão geral histórica total.

              ### Gráficos disponíveis

              - top 5 sabores mais pedidos;
              - tamanhos mais vendidos;
              - canais de venda;
              - ranking de sabores.

              ### Indicadores exibidos

              - faturamento bruto;
              - custos totais;
              - lucro líquido.

              ---

              ## Módulo de backup e publicação

              O sistema trabalha com dois tipos de exportação diferentes:

              1. Cardápio público em JSON
                 - arquivo: cardapio_publico.json
                    - objetivo: alimentar a página pública de pedidos
                       - é consumido por pedido.html sem depender do LocalStorage

                       2. Backup interno completo
                          - arquivo gerado com nome no padrão backup_provoleta_YYYY_MM_DD.json
                             - objetivo: restaurar o sistema inteiro no navegador
                                - contém todos os dados do LocalStorage
                                   - não deve ser enviado aos clientes

                                   ### Fluxo de publicação do cardápio

                                   O processo é:

                                   1. cadastrar categorias, sabores, bebidas e bairros em Cadastros;
                                   2. configurar nome da loja, WhatsApp, horário e mensagem de boas-vindas;
                                   3. exportar o JSON público;
                                   4. substituir o arquivo cardapio_publico.json do projeto;
                                   5. publicar no GitHub ou em hospedagem estática;
                                   6. clientes acessam a página pedido.html e o cardápio é carregado via JSON.

                                   ---

                                   ## Página pública para clientes

                                   ### Arquivo principal

                                   A página pública é pedido.html e sua lógica está em js/pedido.js.

                                   ### Comportamento

                                   A página pública:

                                   - carrega o cardápio a partir do arquivo JSON cardapio_publico.json;
                                   - exibe pizzas e bebidas;
                                   - permite montar uma sacola com produtos;
                                   - mostra taxa de entrega conforme o bairro selecionado;
                                   - coleta dados do cliente (nome, telefone, endereço, bairro, pagamento e observações);
                                   - gera uma mensagem pronta para o WhatsApp;
                                   - abre o WhatsApp da loja com o pedido preenchido.

                                   ---

                                   ## Como rodar localmente

                                   ### Opção simples

                                   Abra o arquivo index.html em um navegador, ou rode um servidor local simples:

                                   ```bash
                                   python -m http.server 8000
                                   ```

                                   Em seguida, acesse:

                                   - http://127.0.0.1:8000/index.html
                                   - http://127.0.0.1:8000/pedido.html

                                   ### Recomendação

                                   Usar um servidor local evita problemas de fetch para arquivos JSON e melhora a experiência de desenvolvimento.

                                   ---

                                   ## Melhorias recentes implementadas

                                   O sistema já recebeu atualizações importantes para ficar mais profissional e preparado para uso comercial:

                                   - proteção do painel administrativo com overlay e senha de acesso;
                                   - sincronização do cardápio público com os cadastros do painel;
                                   - snapshot do cardápio em LocalStorage para manter a página pública atualizada;
                                   - exportação do JSON público diretamente pelo painel;
                                   - interface pública mais mobile-first, com navegação sticky e botão flutuante de sacola;
                                   - drawer de carrinho para mobile com resumo e fechamento por overlay;
                                   - favicon com fallback inline SVG para evitar quebra visual.

                                   ---

                                   ## Limitações e boas práticas

                                   - o sistema é local e não substitui um backend completo;
                                   - dados ficam apenas no navegador do usuário;
                                   - para uso real em produção, é recomendável migrar para uma solução com banco de dados e autenticação real;
                                   - faça backup regularmente com o módulo de backup do sistema.

                                   ---

                                   ## Resumo executivo

                                   O Sistema Provoleta é uma solução prática e bem organizada para gerir uma pizzaria delivery de forma simples, com foco em operação local, baixo custo e boa experiência para o cliente. Ele já oferece um painel administrativo completo, uma página pública moderna e um fluxo de pedido via WhatsApp que é direto e funcional.

                                   ### Regras da página pública

                                   - Não usa LocalStorage;
                                   - Não depende do painel administrativo para funcionar;
                                   - Funciona apenas com o JSON público carregado;
                                   - Se o arquivo não existir ou estiver inválido, mostra uma tela de cardápio indisponível.

                                   ---

                                   ## Configuração e personalização

                                   ### Informações da loja

                                   No módulo de Backup / Publicar é possível definir:

                                   - nome da loja;
                                   - WhatsApp;
                                   - horário de funcionamento;
                                   - mensagem de boas-vindas.

                                   Essas informações são usadas pela página pública e pelo JSON exportado.

                                   ### Número do WhatsApp

                                   O sistema usa um número padrão em `js/constants.js` e também suporta um WhatsApp configurado pela loja. A função utilitária de geração de link do WhatsApp converte o número em um link wa.me.

                                   ### Estilo visual

                                   Os estilos estão divididos em:

                                   - `css/variables.css`: variáveis de tema;
                                   - `css/layout.css`: estrutura geral;
                                   - `css/components.css`: componentes reutilizáveis;
                                   - `css/pages.css`: estilos das páginas do painel;
                                   - `css/pedido.css`: estilos da página pública.

                                   ---

                                   ## Fluxo de dados entre administração e página pública

                                   O fluxo é o seguinte:

                                   1. O administrador cadastra os dados no painel interno.
                                   2. Esses dados são salvos no LocalStorage.
                                   3. O módulo de backup exporta um JSON público com um subconjunto desses dados.
                                   4. O arquivo `cardapio_publico.json` é publicado.
                                   5. A página `pedido.html` lê esse JSON.
                                   6. O cliente monta o pedido e envia via WhatsApp.

                                   Ou seja, o sistema tem uma separação clara entre:

                                   - dados privados do gerenciamento interno;
                                   - dados públicos do cardápio do cliente.

                                   ---

                                   ## Como usar pela primeira vez

                                   1. Abra `index.html` em um navegador.
                                   2. O sistema irá criar dados iniciais de exemplo automaticamente.
                                   3. Entre em Cadastros e ajuste categorias, sabores, bebidas, bairros e motoboys.
                                   4. Vá para Pedidos e lance alguns pedidos para testar.
                                   5. Acesse o módulo de Fluxo de Caixa para registrar despesas.
                                   6. Use o módulo de Backup / Publicar para exportar o cardápio público.

                                   ---

                                   ## Pontos importantes e limitações

                                   - O sistema é local e depende do navegador do usuário.
                                   - Não há autenticação, login ou múltiplos usuários simultâneos.
                                   - Não há banco de dados remoto nem sincronização entre dispositivos.
                                   - O backup é a forma principal de preservar os dados.
                                   - A publicação do cardápio público depende de publicar um arquivo JSON estático.
                                   - O painel administrativo não é uma solução corporativa de ERP, mas sim uma ferramenta prática para gestão simples de pizzaria delivery.

                                   ---

                                   ## Regras de negócio resumidas

                                   - pedidos são registrados por mês;
                                   - números de pedido são sequenciais por mês;
                                   - receitas vêm dos pedidos não cancelados;
                                   - despesas são controladas separadamente;
                                   - estoque atual considera estoque inicial + entradas - saídas;
                                   - bairros possuem taxas de entrega individuais;
                                   - motoboys recebem relatórios e comparativos de fechamento;
                                   - o cardápio público é exportado de forma separada do backup interno.

                                   ---

                                   ## Resumo executivo

                                   Este projeto é uma aplicação web leve, modular e funcional para gestão básica de uma pizzaria delivery. Ele combina um painel administrativo com uma página pública de pedidos, tudo com foco em praticidade, portabilidade e uso local, sem necessidade de infraestrutura complexa.

                                   Ele é ideal para quem quer começar com um sistema simples, controlar vendas e custos mensalmente, manter um cardápio online e receber pedidos pelo WhatsApp sem depender de plataformas caras.
                                   