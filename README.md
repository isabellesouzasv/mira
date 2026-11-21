# Mira

Aplicativo pessoal para registrar horas de estudo, acompanhar a meta diária e consultar o histórico.

## Executar localmente

Execute o servidor na raiz do projeto.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra [http://127.0.0.1:8000](http://localhost:8000) em um navegador moderno. Use sempre o mesmo endereço e porta para manter o acesso aos registros do navegador.

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
