# Desenvolvimento em TypeScript

A conversão dos fontes para TypeScript está concluída. Após a remoção do menu
antigo, a adoção da localização nativa, os construtores de conteúdo e os temas de HUD/menu/placar, o projeto gera 266 arquivos Lua, incluindo
módulos extraídos para separar responsabilidades. A validação no Garry's Mod está pendente.

Edite os `.ts` em `src/`. O GMod executa exclusivamente os `.lua` gerados em
`gamemodes/`, nos caminhos existentes. A analogia com `.class` ajuda a distinguir
fonte e artefato, mas aqui o artefato continua sendo código Lua legível, sem tipos.
Assets, arquivos de configuração do gamemode e dados persistidos continuam sendo
necessários. TypeScript e npm são ferramentas de desenvolvimento.

## Compilar e verificar

Requer Node.js 22+ com npm. As versões das dependências estão fixadas no lockfile.

```sh
npm ci
npm run build
npm test
npm run dev
```

- `build`: compila em uma pasta temporária e valida toda a sintaxe Lua 5.1 antes
  de atualizar os arquivos do gamemode.
- `build:check`: confere se o Lua local e a lista de ignores correspondem aos fontes, sem gravar.
- `typecheck`: verifica servidor, cliente e exemplos de contratos inválidos.
- `test`: verifica tipos, gera o Lua local e executa regressões de runtime simuladas.
- `dev`: recompila ao salvar; erros de compilação preservam a saída anterior.

No PowerShell deste workspace, o wrapper usa o Node instalado ou a distribuição
portátil em `.tools/`, sem alterar permanentemente o PATH:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\npm.ps1 run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\npm.ps1 test
```

Versione `src/`, `types/`, os scripts, configurações, testes, lockfile e `gamemodes/.gitignore`. O Lua gerado não é versionado.
`node_modules/`, `.tools/` e `.build/` ficam ignorados. O build sincroniza `gamemodes/.gitignore` com os caminhos exatos de `migration.json`, sem ignorar assets, traduções ou Lua manual. Um checkout novo precisa de compilação. Para instalar no GMod, execute `npm ci` e `npm run build`, depois
distribua `gamemodes/` com os assets. O servidor não precisa de Node.js.

### Conflito com a versão do Workshop

Ao testar a versão local, desative o addon **Zombie Plague** do Workshop
(`1115250691`) e reinicie completamente o Garry's Mod. Ele contém arquivos com
os mesmos caminhos e pode misturar o código antigo com os registros TS atuais,
mesmo quando a pasta local está atualizada.

Os sintomas confirmados incluem `sv_message.lua:42` passando uma tabela para
`net.WriteString` e `sv_extraitems.lua:16` carregando um item cujo construtor
`ExtraItemDefinition` ainda não existe. Ambos os caminhos e números de linha
correspondem à cópia antiga do Workshop. Confira qual versão está montada antes
de alterar os fontes ou copiar arquivos isolados.

## Organização

A raiz de `src/gamemodes/zombieplague/gamemode/` contém somente os pontos de
entrada `init.ts`, `cl_init.ts` e `shared.ts`. Os demais fontes estão agrupados
por domínio. Cada pacote contém `shared/`, `server/` e/ou `client/`, criando apenas
as pastas que tenham código. Os prefixos `sv_`, `cl_` e `sh_` foram mantidos.

```text
player/
  shared/
    sh_player.ts
    sh_playermanager.ts
  server/
    sv_player.ts
    sv_player_abilities.ts
    ...
  client/
    cl_player.ts
```

| Pasta | Responsabilidade |
| --- | --- |
| `player/` | Player compartilhado/cliente/servidor, habilidades, estado, armas e infecção |
| `events/` | Registro de eventos, combate, eventos de Player e atualizações periódicas |
| `rounds/` | Estado, participação, tipos de rodada, ciclo de vida e votação de mapas |
| `weapons/` | Manager, seleção, registros de armas e disparo de granadas |
| `weapons/client/construction/` | Suporte visual do SWEP Construction Kit |
| `classes/` | Manager e definições das classes humanas/zumbis |
| `extraitems/` | Manager e definições de itens extras |
| `bank/` e `bank/server/storage/` | Banco e persistência de saldos |
| `maps/server/` e `maps/server/configs/` | Manager e configurações dos mapas |
| `languages/server/` | Distribuição dos catálogos nativos em `content/resource/localization/` |
| `interface/client/` | Dados do HUD, temas de HUD/menu, teclado e scoreboard |
| `menus/` | Contratos, serviço de seleção de armas e apresentações substituíveis da POC |
| `effects/` | Partículas de servidor e cliente |
| `messaging/` | Mensagens de servidor e cliente |
| `core/` | Utilitários, comandos, convars e validação de dados do cliente |
| `config/` | Configurações gerais do gamemode |

Os SWEPs registrados pelo motor ficam em `weapons/shared/sweps/` e as granadas
em `weapons/shared/projectiles/`. O disparo comum fica em `weapons/shared/`.
As regras de servidor e cliente desses arquivos compartilhados continuam
protegidas por `SERVER` e `CLIENT`.
Essas pastas são módulos por responsabilidade, carregados pelo `include` do GMod.

`migration.json.files` lista os caminhos **Lua de runtime**, sem extensão.
`sourcePaths` mapeia esses caminhos para fontes TS cuja organização é diferente.
Quando não há mapeamento, o fonte espelha o caminho de runtime. Exemplo:

```json
"gamemodes/zombieplague/gamemode/sv_player_abilities":
  "gamemodes/zombieplague/gamemode/player/server/sv_player_abilities"
```

Assim, mover um fonte TS não altera includes, `AddCSLuaFile`, caminhos dos addons
nem diretórios pesquisados pelos loaders de conteúdo. O cabeçalho do Lua gerado
indica o caminho atual do TS. Os corpos Lua permanecem iguais após a reorganização.

Para adicionar código, registre o caminho de runtime em `files` e, se necessário,
o caminho de fonte em `sourcePaths`; atualize os includes e `AddCSLuaFile` que o
carregam. Cada fonte deve aparecer exatamente uma vez. Mapeamentos inválidos ou
duplicados falham antes de gravar. O build não limpa `gamemodes/` nem altera
arquivos fora do manifesto.

## Contratos e integração

A tipagem usa `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.
As declarações em `types/` cobrem as APIs utilizadas, não toda a API do GMod.

`tsconfig.json` é o ponto de entrada do editor e referencia os dois projetos.
`tsconfig.base.json` concentra as opções estritas e do TypeScriptToLua.
`tsconfig.server.json` verifica servidor e os contratos de engine das entidades/SWEPs,
incluindo o suporte de renderização em `weapons/client/construction/`.
`tsconfig.client.json` verifica `cl_*`, VGUI e fontes compartilhados com contratos
próprios de cliente. O build exige saída idêntica dos fontes compartilhados nos
dois contextos. Entidades e SWEPs têm um único fonte compartilhado, com os trechos
de gameplay protegidos por `SERVER` e renderização por `CLIENT`; são compilados
pelo primeiro contexto usando as declarações de `weapon-engine` e `weapon-render`.
Essa exceção de compilação já existia antes da organização em pacotes; as pastas
descrevem onde o código executa. Os padrões de compilação seguem os nomes dos
arquivos (`cl_*`, `sh_*` e `vgui/`), não apenas o nome da pasta.

Por exemplo, classes de Player são definições no servidor e nomes no cliente;
`net.Receive` recebe o remetente apenas no servidor. Os testes de tipos impedem
confundir essas assinaturas nos consumidores do gamemode.

### Tipos no editor

Abra a raiz do repositório no VS Code ou editor compatível. A configuração em
`.vscode/settings.json` indica o TypeScript instalado em `node_modules`, na
mesma versão usada pelo build. Se solicitado, selecione **Use Workspace Version**.
Depois de atualizar as configurações, execute **TypeScript: Restart TS Server**
na paleta de comandos (`Ctrl+Shift+P`). Se ainda não houver dependências,
execute `npm ci` antes de abrir os fontes.

O arquivo principal referencia explicitamente servidor e cliente para que o
editor encontre `tsconfig.client.json`. Sem essa referência, arquivos `cl_*`
excluídos do servidor caíam em um projeto inferido, sem os contratos do GMod.
O teste de integração do editor abre fontes no `tsserver` e verifica o projeto
selecionado e os diagnósticos, incluindo as extensões de linguagem do TSTL.

As declarações de `types/` e `@typescript-to-lua/language-extensions` são globais
em cada contexto. Elas não precisam de imports nos fontes; o carregamento real
continua sendo feito por `include`/`AddCSLuaFile` do GMod. Não adicione imports de
runtime apenas para resolver um erro de configuração do editor.
Veja as referências oficiais de [projetos TypeScript](https://www.typescriptlang.org/docs/handbook/project-references)
e [versão do TypeScript no VS Code](https://code.visualstudio.com/docs/typescript/typescript-transpiling#_using-the-workspace-version-of-typescript).

Métodos declaram `this` para gerar `:`; funções globais usam `this: void` e
bibliotecas usam `@noSelf` para gerar `.`. Callbacks e timers preservam seu contexto
explicitamente. SteamID64 permanece string; ausência em TS vira `nil` em Lua.

Globais públicas continuam disponíveis para addons Lua. `_G` aparece na instalação
dessas globais; consumidores usam os nomes tipados normalmente. Cada fonte usa
`export {}` para isolar variáveis locais. Mantemos `include` e helpers inline;
não há dependência de `require` ou `lualib_bundle.lua`.

Armas, itens extras e classes exportam instâncias criadas nos próprios arquivos.
Os contextos `Weapon`, `ZPClass` e `ExtraItem` continuam preparados pelos loaders
para addons Lua antigos; `MapConfig` mantém seu carregamento anterior.
Rodadas extras podem registrar definições
com `RoundManager:AddRoundType(id, definition)` ao serem incluídas. O loader antigo
de rodadas extras usava um caminho e uma assinatura incorretos; não havia arquivos
de rodadas extras no repositório para converter.

## Classes e instâncias

Os gerenciadores de armas, classes, itens extras, mapas, infecção, jogadores,
rodadas, votação, banco, comandos, convars e partículas usam classes.
HUD, teclado e o backend de texto também usam classes.
O envio de mensagens do servidor usa `ServerMessageManager`, com uma instância
local em `messaging/server/sv_message.ts`. As funções globais `Send*` e `Broadcast*`
delegam para essa instância e preservam a API sem `self` dos consumidores e addons.
Dentro da classe, broadcasts e envios localizados usam métodos de `this`.
Cada implementação mantém seu contrato com `implements`, campos tipados e métodos
que operam sobre `this`. As coleções mutáveis pertencem à instância.

O módulo responsável cria a instância usada pelo gamemode e publica a referência
para os consumidores existentes. Por exemplo, em `weapons/server/sv_weaponmanager.ts`:

```ts
export class WeaponManager implements ZPServerWeaponManager {
    // Campos e métodos do gerenciador.
}

const weaponManager = new WeaponManager();
_G.WeaponManager = weaponManager;
```

Nesse módulo, `WeaponManager` é o construtor. Nos demais fontes e nos addons Lua,
o nome global `WeaponManager` continua sendo a **instância**, com chamadas como
`WeaponManager.SearchWeapons()` em TS e `WeaponManager:SearchWeapons()` em Lua.
Não crie outra instância para cada chamada: o jogo usa uma instância por realm.
Os construtores são exportados pelo módulo; isso não introduz `require`.
O carregamento continua usando `include`, e imports de runtime ainda exigem
uma integração explícita com o carregador do GMod.

O TypeScriptToLua emite construtores e protótipos Lua com helpers inline.
Métodos normais ficam no protótipo; `pairs(instance)` e `rawget(instance, name)`
inspecionam os campos próprios, sem enumerar os métodos herdados. Campos públicos
e nomes dos métodos existentes foram mantidos para compatibilidade.
As extensões de servidor e cliente de `RoundManager` continuam instaladas sobre
a mesma instância criada no compartilhado, preservando sua identidade e o
carregamento dos módulos de participação, definições e ciclo de vida.

Callbacks entregues diretamente a hooks, timers ou comandos não recebem `self`.
`AmmoPackBank.Save` e `ConvarManager.ListCvars` são campos arrow que capturam sua
própria instância. Outros métodos devem ser chamados por wrappers quando usados
como callbacks, por exemplo `() => manager.Update()`. O banco aceita um backend
opcional no construtor para permitir composição sem depender do backend global.

`Utils` e `ZPClientData` continuam sendo utilitários sem estado. Configurações de
mapas e rodadas continuam como dados. Player, SWEPs, entidades e painéis
mantêm as tabelas/metatables exigidas pelo motor; não são instanciados com `new`.

### Definições de armas, itens e classes

Os 154 registros de armas, 21 itens extras e 18 classes humanas/zumbis usam
construtores tipados. Cada arquivo fornece os atributos específicos; o construtor
completa os valores padrão e métodos. Exemplo em `weapons/server/arccw/arccw_ruger.ts`:

```ts
export default new WeaponDefinition({
    PrettyName: "Target2/2",
    WeaponID: "arccw_ruger",
    DamageMultiplier: 2.4,
    WeaponType: WEAPON_SECONDARY,
});
```

`WeaponDefinition` exige `PrettyName` e `WeaponID`. `ExtraItemDefinition` exige
`ID`, `Name`, `Price` e `OnBuy`. `HumanClassDefinition` e `ZombieClassDefinition`
exigem `ID` e estabelecem a equipe correspondente. Outros atributos e callbacks
podem ser fornecidos no mesmo objeto. Callbacks de definição preservam seu
`this`; callbacks de hooks/timers continuam sem `self`.

Os managers carregam e publicam os construtores antes de pesquisar os registros.
O `include` retorna a tabela do módulo TS; sua propriedade `default` contém a
instância. O loader verifica a disponibilidade e registra essa instância em seu
próprio manager. Os arquivos não alteram globais temporárias nem registram classes
diretamente em `ClassManager`. Não há imports de runtime nem dependência de `require`.

Para addons Lua existentes, permanecem as factories `CreateNewWeapon`,
`NewHumanClass` e `NewZombieClass`, as globais temporárias dos loaders e o registro
legado por `AddZPClass`. Os testes cobrem os dois formatos, o isolamento entre
managers, valores padrão, disponibilidade e o contexto dos callbacks.
Os testes de classes verificam isolamento de registros e listas de armas,
callbacks associados à instância e persistência com falha e nova tentativa.

## Mudanças de comportamento identificadas

- Conforme confirmado pelo autor, a M9K USP usa multiplicador **1.9**.
- Conforme confirmado pelo autor, seleção de armas pode ser salva em qualquer
  estado; entrega de armas escolhidas ocorre somente para humano vivo.
- Conforme confirmado pelo autor, granadas de infecção e antídoto respeitam
  o atraso configurado, atualmente **5 segundos**, nos modos com temporizador.
  Seus timers identificam a entidade para evitar colisão entre lançamentos simultâneos.
- Pacotes de seleção/votação e configurações JSON têm validação de formato.
  Mapas desconhecidos e votos repetidos são rejeitados. Sem mapas elegíveis,
  o mapa atual é estendido para evitar falha de votação.
- Participação na partida não duplica jogadores; entradas inválidas são removidas.
  A saída do último humano/zumbi considera o time anterior para escolher substituto.
- Rodadas especiais capturam suas próprias definições nos callbacks. Timers
  chamam managers preservando `self`.
- Leitura de flags usa `GetGlobalBool`, correspondente à escrita. A convar do
  banco usa default string; convars de bateria recebem flags e descrição corretamente.
  As opções `zp_water_should_drain` e `zp_run_should_drain` agora são declaradas.
- Classes têm busca/fallback corrigidos. Itens temporários são limpos no hook
  `ZPEndRound` e removidos da fila uma única vez.
- Banco de texto tolera saldo ausente/corrompido e grava texto; falhas de gravação
  mantêm o saldo na fila para nova tentativa.
- Preferências de tema/teclado inválidas usam defaults. Traduções seguem o idioma
  nativo do cliente, sem preferência de idioma própria do gamemode.
- Granadas e timers verificam entidades removidas; efeitos de gameplay executam
  somente no servidor. Modelos visuais são removidos ao remover o SWEP.
- A busca recursiva usa o caminho completo como chave para não perder arquivos
  de mesmo nome em diretórios diferentes.

Regras antigas de dano de queda, excesso de dano na armadura e recompensa de
morte humana foram preservadas para uma revisão de balanceamento separada.

## Validação

Os testes executam o Lua gerado no Fengari (Lua 5.3) com mocks do GMod e validam
a sintaxe com parser Lua 5.1. Cobrem contratos de chamada, loaders de conteúdo,
idiomas, banco, armas, rodadas, ciclo de votação, teclado, granadas, ausência do
menu antigo e proteções do build.
Isso não verifica física, userdata, desenho VGUI, animações, previsão ou rede real.

No Garry's Mod, conferir:

1. Inicialização de servidor e cliente sem erros; entrada durante uma partida.
2. Classes, habilidades, infecção/cura, mortes e saída do último humano/zumbi.
3. POC de armas via F4, troca de HUD, scroll, entrega e seleção para o próximo
   spawn humano; addons de armas.
4. Seis tipos de rodada, congelamento, timers, respawn, vitória e término da votação sem interface.
5. Banco após reconexão/reinício; idiomas nativos distintos entre jogadores,
   troca de `gmod_language`, fallback inglês, HUD, teclas e scoreboard.
6. Punhos, granadas nos três modos e modelo de antídoto em primeira/terceira pessoa.

O [diagnóstico inicial](project-diagnosis.md) permanece como registro dos achados
anteriores à conversão; seus números e problemas descrevem aquele ponto de partida.

## Remoção do menu antigo

O menu numérico e a janela de opções foram removidos, incluindo os painéis de
customização antiga de posição do HUD e teclas. A seleção de armas usa agora a POC descrita abaixo.
Foram retirados os
hooks de desenho e leitura de teclas do menu, seus atalhos, comandos de abertura,
mensagens de requisição/resposta e a abertura automática na conversão para humano.
Os antigos overrides vazios de `ShowSpare1`/`ShowSpare2` também foram retirados.

Escolher classes, itens, idioma, rodada administrativa, entrar/sair de
espectador e votar em mapas pela interface fica indisponível até o novo menu.
O ciclo de votação continua e termina pelo timer existente, sem receber votos
pela interface antiga. Nenhum novo critério de desempate foi introduzido.

Registros e regras de gameplay, banco, HUD, scoreboard, habilidades e visão
noturna permanecem. A entrega de armas já selecionadas e o comportamento de bots
foram preservados; humanos sem seleção não recebem um substituto automático.
Os canais `SendHumanClass`/`SendZombieClass` continuam sincronizando classes do
servidor para o HUD, mas não aceitam mais escolhas enviadas pelo menu antigo.
Arquivos persistidos de HUD e teclas não são apagados; o HUD ignora as posições
antigas e usa o layout do tema selecionado (ver [temas](themes.md)). Atalhos antigos de menu
não são carregados pelo gerenciador de teclas.

### POC do novo seletor de armas

A seleção de armas voltou por uma base independente do visual. F4 abre o menu
principal, com acesso à opção Armas; `zp_weapons` e `/weapons` abrem diretamente
o seletor. Os temas clássico, HL2 e CS 1.6 usam a mesma API e rede.
O evento `MainMenu` reaproveita a tecla salva de `WeaponMenu`, quando existente.
No spawn humano normal, o servidor pede a primeira categoria ainda sem escolha;
o cliente avança por primária, secundária e corpo a corpo após confirmação.
Os setters existentes preservam salvamento em qualquer estado e entrega única
por categoria durante uma vida humana. Veja [contrato, prévias e teste em jogo](weapon-menu-poc.md).

## Localização nativa

As 1.083 frases existentes nos oito idiomas, incluindo registros dos itens extras,
foram transferidas sem alterar seus textos para
`gamemodes/zombieplague/content/resource/localization/<idioma>/zombieplague.properties`.
Esses arquivos são a fonte das traduções e devem ser editados diretamente; não
são Lua gerado. O build os preserva. Cada arquivo começa com uma linha vazia e
usa chaves `zombieplague.<identificador em minúsculas>`, evitando colisões com addons.

| Código antigo | Código nativo |
| --- | --- |
| `en-us` | `en` |
| `pt-br` | `pt-BR` |
| `es-ar` | `es-ES` |
| `ru` | `ru` |
| `uk` | `uk` |
| `tchinese` | `zh-TW` |
| `ja` | `ja` |
| `ko` | `ko` |

O conteúdo espanhol existente é mantido sob `es-ES`, o código suportado pelo jogo.
O GMod carrega os catálogos conforme `gmod_language`, com inglês preenchendo frases
ausentes. HUD, scoreboard, classes e granadas consultam `language.GetPhrase` no
cliente. Não há parser de `.properties`, registro de idiomas ou dicionário em Lua.
O módulo `sv_localization.lua` registra os oito arquivos com `resource.AddFile`;
inclua `content/resource/localization/` na distribuição local, Workshop ou FastDL.

Mensagens localizadas usam o mesmo conjunto de funções `Send*Message` e
`Broadcast*Message`, passando um descritor em vez de texto já traduzido:

```ts
SendPopupMessage(ply, {
    Phrase: "zombieplague.ammopackgivename",
    Arguments: [requester.Name(), amount],
});
```

O novo canal `SendLocalizedMessage` envia a chave, parâmetros e apresentação.
O cliente valida o descritor, consulta a tradução nativa e aplica `string.format`.
Parâmetros podem conter descritores de outras frases, como o nome de um item;
nomes de jogadores e strings comuns são sempre literais. Os canais anteriores
continuam aceitando texto literal, preservando seus formatos de rede.

`Dictionary`, `RegisterPhrase`, `Player:SetLanguage`/`GetLanguage` e
`SendPlayerLanguage` foram removidos. Addons que usavam essas APIs próprias devem
adotar `.properties` e mensagens com descritores. O arquivo antigo
`data/zombieplague/language.txt` não é mais lido nem escrito; não é apagado.
O pedido inicial de estado do servidor não envia mais um idioma.

Os testes verificam Unicode, cobertura de chaves, parâmetros de formatação,
distribuição dos catálogos e mensagens em idiomas diferentes com o mesmo payload.
O carregamento efetivo dos arquivos pelo motor e sua distribuição real aos
clientes ainda precisam de validação em jogo. Referências:
[localização nativa](https://wiki.facepunch.com/gmod/Addon_Localization),
[language.GetPhrase](https://wiki.facepunch.com/gmod/language.GetPhrase) e
[resource.AddFile](https://wiki.facepunch.com/gmod/resource.AddFile).
