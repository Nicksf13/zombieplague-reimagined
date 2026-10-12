# Instruções para agentes

## Contexto e referências

- Este é um gamemode de Garry's Mod em migração gradual de GLua para TypeScriptToLua.
- Responda ao usuário em português e explique mudanças de comportamento com clareza.
- Consulte `docs/typescript-migration.md` para o fluxo de desenvolvimento e
  `docs/project-diagnosis.md` para os achados e a sequência proposta de migração.
- Preserve alterações existentes no workspace que não pertençam à tarefa atual.

## Arquivos curtos e contexto eficiente

- Escreva arquivos pequenos, coesos e com uma responsabilidade clara, para que
  uma IA consiga entender e alterar um sistema lendo poucos arquivos e tokens.
- Use cerca de 150–250 linhas como sinal para avaliar a divisão de um arquivo,
  não como limite obrigatório. Separe responsabilidades, não blocos arbitrários.
- Prefira nomes descritivos e contratos explícitos. Mantenha regras relacionadas
  próximas; evite fragmentação que obrigue a abrir muitos arquivos para uma tarefa simples.
- Agrupe fontes relacionados em pastas por domínio (`player/`, `events/`,
  `rounds/`, `weapons/` etc.). Reserve a raiz do gamemode aos pontos de entrada.
  Dentro de cada domínio, use `shared/`, `server/` e `client/` conforme o realm;
  crie apenas pastas que tenham código. Registros de conteúdo são do servidor.
  Mantenha os prefixos `sv_`, `cl_` e `sh_`, usados pela compilação por realm.
- Extraia partes quando houver uma fronteira real: persistência, validação de
  rede, regras de domínio, registro de conteúdo ou apresentação.
- Não reestruture arquivos grandes sem relação com a tarefa apenas para reduzir
  linhas. Não compacte código nem remova explicações úteis para economizar tokens.
- Use `rg` para localizar símbolos e leia primeiro os trechos relevantes.
  Evite despejar arquivos grandes, Lua gerado, lockfiles ou dependências no contexto.
- Documente decisões e contratos; evite comentários que apenas repitam o código.
- Prefira classes com campos tipados e `implements` para gerenciadores com estado.
  Crie uma instância por realm no módulo responsável e publique-a em `_G` apenas
  para manter a API pública existente. Métodos devem operar sobre `this`, sem
  capturar a instância global. Callbacks sem `self` podem usar campos arrow.
  Preserve as tabelas/metatables exigidas pelo GMod e os registros de dados;
  utilitários sem estado não precisam virar classes.

## Migração e compatibilidade

- `migration.json` identifica os arquivos migrados. Para eles, edite o `.ts` em
  `src/` e regenere o `.lua`; nunca corrija manualmente apenas a saída gerada.
- `files` lista os caminhos Lua de runtime; `sourcePaths` mapeia esses caminhos
  para fontes organizados em pastas. Ao mover TS, atualize esse mapeamento para
  preservar os caminhos usados pelo GMod, loaders de registros e addons.
- Edite normalmente o GLua ainda não migrado. Versione os fontes TS e o Lua gerado.
- Separe correções de bugs da conversão, mantendo cada mudança identificável.
- Preserve caminhos, ordem de `include`, `AddCSLuaFile`, globais públicas, hooks,
  IDs e protocolos usados pelo legado e pelos addons. Ao dividir arquivos,
  atualize seu carregamento e distribuição ao cliente no mesmo lote.
- Não introduza imports de runtime sem resolver como o `require` emitido será
  carregado no GMod. Imports exclusivos de tipos não têm esse efeito.
- Respeite servidor, cliente e compartilhado. Não presuma que métodos com o mesmo
  nome têm a mesma assinatura nos dois realms. Preserve `self`/`this` e `:`/`.`.
- Mantenha tipos estritos. Evite `any` e casts que escondam contratos incompletos.
  Trate ausências explicitamente e mantenha SteamID64 como string.
- Tipagem não valida dados externos: valide mensagens de rede, arquivos e JSON
  em runtime. Permissões e regras de gameplay devem ser verificadas no servidor.
- Preserve assets e dados persistidos. O build não deve limpar `gamemodes/`.

## Validação

- Após alterar fontes migrados, execute `npm run build` e `npm test`.
- No PowerShell sem Node no PATH, use `scripts/npm.ps1`; se a política bloquear
  scripts, execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\npm.ps1 test`
  (para compilar, substitua `test` por `run build`).
- Para bugs de comportamento, adicione regressões relevantes quando viável.
  Mudanças apenas de documentação dispensam testes de runtime.
- Os testes locais simulam o GMod. Informe o que foi validado e o que ainda
  depende do jogo; não declare uma partida validada sem executá-la no motor.
