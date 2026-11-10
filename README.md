# 🌭 Gestão do Cachorro-Quente

Aplicação web para controlar as finanças de um negócio de venda de cachorro-quente em dias específicos: faturamento bruto, gastos com insumos, combustível, embalagem e perdas, e o lucro líquido, com resumos **diário, semanal e mensal**.

**Demo:** https://santisantos13.github.io/cachorro-quente-web/

## Funcionalidades

- Cadastro de dias de venda e lançamentos de receitas e despesas por categoria
- Resumo por dia, semana ou mês, com totais e gastos por categoria
- Exportação para planilha (CSV, abre direto no Excel)
- Backup e restauração dos dados em arquivo JSON
- Modo claro e escuro, que lembra a escolha
- Layout responsivo, pensado para uso no celular

## Tecnologias

HTML, CSS e JavaScript puro, sem frameworks. Os dados ficam no `localStorage` do navegador, então não existe servidor e nada é enviado pra internet.

## Decisões técnicas

- Valores em dinheiro armazenados em **centavos (inteiros)** para evitar erros de ponto flutuante nas somas.
- Validação dos dados ao ler o armazenamento e ao restaurar um backup.
- Texto digitado pelo usuário é escapado antes de ir para o HTML.
- Datas montadas pelas partes (ano, mês, dia) para evitar problemas de fuso horário.

## Como rodar

Baixe o projeto e abra o `index.html` no navegador. Não precisa instalar nada.
