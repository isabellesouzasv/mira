# Mira

Aplicativo pessoal para registrar horas de estudo, acompanhar a meta diária e consultar o histórico.

## Executar localmente

Execute o servidor na raiz do projeto.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra [http://127.0.0.1:8000](http://localhost:8000) em um navegador moderno. Use sempre o mesmo endereço e porta para manter o acesso aos registros do navegador.

## Publicar no GitHub Pages

1. Envie a branch `main` para um repositório público chamado `mira` no GitHub para usar o plano gratuito.
2. Em **Settings → Pages**, selecione **Deploy from a branch**, escolha **main** e **/(root)** e clique em **Save**.
3. Quando o endereço aparecer em **Pages**, abra `https://SEU-USUARIO.github.io/mira/` e mantenha **Enforce HTTPS** ativado.

O site é servido diretamente da raiz do repositório. A configuração está descrita na [documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

No iPhone, abra o endereço no Safari e toque em **Compartilhar → Adicionar à Tela de Início**. Ative **Abrir como App da Web** se a opção estiver disponível. O cronômetro usa Web Locks, disponível a partir do [iOS 15.4](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).

Os registros existentes continuam disponíveis no endereço original. O endereço do GitHub Pages tem armazenamento próprio e começa com o histórico vazio.

## Testes

Execute os testes com Node.js 24.5 ou mais recente.

```sh
node --test tests/*.test.mjs
```

## Comportamento dos registros

- Os dados ficam no armazenamento local do navegador. Limpar os dados do site apaga as sessões e configurações.
- O cronômetro usa Web Locks para coordenar as abas. O servidor local oferece o contexto seguro necessário. Em um navegador sem Web Locks, o histórico e os registros manuais continuam disponíveis.
- Se o navegador encerrar sem avisar a página, o Mira recupera o último ponto salvo e apresenta a sessão pausada. O intervalo após esse ponto pode ser perdido.
- A semana começa na segunda-feira. As médias incluem os dias sem estudo e usam os dias decorridos do período, incluindo hoje.
- Uma sessão que atravessa a meia-noite gera um registro por dia com tempo contabilizado. A duração total mantém precisão de segundos. A edição em horas e minutos preserva os segundos restantes de um registro do cronômetro.
