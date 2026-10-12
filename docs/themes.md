# Temas de menu e HUD

Uma escolha controla o menu principal, o menu de armas, o HUD do jogador e o scoreboard. Os temas iniciais são
`classic` (amarelo), `hl2` (âmbar, inspirado no Half-Life 2) e `cs16` (menu verde
e HUD amarelo sobre painéis verde escuros, inspirado no Counter-Strike 1.6). São interpretações visuais,
sem dependência de fontes, texturas ou addons desses jogos.

No console, use `zp_theme classic`, `zp_theme hl2` ou `zp_theme cs16`.
Sem argumento, `zp_theme` lista os temas registrados. Os botões nos menus
fazem a mesma troca. A preferência fica em `data/zombieplague/theme.json`.
Trocar o tema mantém categoria, catálogo, seleção confirmada e pedido pendente;
não abre o menu nem envia um pedido ao servidor.

Os três temas iniciais exibem o timer no centro inferior e os ammo packs ao lado
da vida e do colete. Em telas mais estreitas, os ammo packs ficam no canto superior
direito para manter os indicadores separados.
Cada tema define as posições e adapta seu layout à resolução. A configuração
antiga de posição, cores e fontes do HUD foi removida: `HUDConfig`, `GetConfig`,
`CalculatePos`, constantes `HUD_LEFT` etc. e leitura/escrita de `hudconfig.json`.
Arquivos antigos já salvos são ignorados, sem apagar dados do jogador.

## Dados e desenho

| Fonte em `interface/client/` | Responsabilidade |
| --- | --- |
| `cl_hud.ts` | Registro de informações e helpers públicos do HUD. |
| `cl_player_hud.ts` | Leitura de Player/Weapon, espectador, filtro de tela e hooks do HUD. |
| `cl_theme_manager.ts` | Registro, seleção e persistência de um tema completo. |
| `cl_theme_hud.ts` | Desenho do HUD nos três estilos, a partir de dados. |
| `cl_scoreboard.ts` | Coleta, ordenação, atualização do placar e ação de silenciar. |
| `cl_scoreboard_hud.ts` | Apresentação do placar nos três estilos, a partir de dados. |

`menus/client/cl_weapon_menu_hud.ts` define as apresentações do menu e registra
os temas usando a mesma paleta para HUD, menus e placar. Os contratos ficam em
`types/client/themes.d.ts`; os módulos são carregados apenas no cliente.

`ZPPlayerHUD:GetState()` entrega uma tabela nova com resolução, timer formatado,
flag de espectador, entradas `{ID, Label, Value}` e munição opcional. Não contém
Player/Weapon nem oferece ações que modifiquem gameplay. `HudManager:CreateHudInfo`
continua permitindo que addons acrescentem informações a essas entradas.

`Ammo.Primary` e `Ammo.Secondary` são opcionais e independentes. Cada um contém
`Clip` e `Reserve`; `Clip < 0` representa arma sem carregador e mostra somente
a reserva. Zero é exibido como zero. Armas sem munição não criam indicadores.
Vida, colete e munição nativos são ocultados quando o tema assume sua exibição;
mira e demais elementos nativos continuam seguindo seus hooks existentes.

Vida/status acompanham o jogador observado. A munição tematizada é do jogador
local vivo; no espectador, preservamos o indicador nativo, pois `Clip1/Clip2` de
outros clientes podem retornar a capacidade em vez do valor atual. Isso evita
exibir um carregador cheio sem confirmação e não adiciona sincronização de rede.
Câmera livre ou alvo inválido mantém somente o timer. Filtros de tela, visão
noturna e luzes continuam funcionando.
As APIs de munição usadas são [Clip1](https://wiki.facepunch.com/gmod/Weapon:Clip1),
[Clip2](https://wiki.facepunch.com/gmod/Weapon:Clip2) e
[GetAmmoCount](https://wiki.facepunch.com/gmod/Player:GetAmmoCount).

## Adicionar um tema

Depois de o gamemode inicializar, por exemplo em `InitPostEntity`, um addon de
cliente pode registrar um tema completo:

```lua
local base = ZPThemes:GetTheme()
ZPThemes:RegisterTheme("meu_tema", {
    Name = "Meu tema",
    Palette = base.Palette,
    CreateWeaponMenu = base.CreateWeaponMenu,
    PaintPlayerHUD = function(state, palette)
        ZPPlayerHUDRenderer:PaintClassic(state, palette)
    end,
})
ZPThemes:UseTheme("meu_tema")
```

Substitua a paleta, a factory de menu e o desenho conforme necessário.
`CreateMainMenu` é opcional: sem ele, o principal usa a apresentação padrão com
a paleta do tema. Para substituir seu layout, forneça uma factory sem `self`
que retorne métodos `Open(state, actions)`, `Update(state)` e `Destroy()` com `self`.
O estado contém `Open`, `Theme` e `Entries` (`ID`, `Label`, `Description`), sem
callbacks de gameplay. As ações disponíveis são `Activate(id)` e `Close()`.
Trocar o tema recria a apresentação aberta sem fazer pedidos de rede.
`CreateWeaponMenu` retorna o contrato `Open/Update/Destroy` descrito na
[POC](weapon-menu-poc.md). `PaintPlayerHUD` é um callback sem `self`, chamado a
cada HUDPaint com dados novos e a paleta. Ele não deve instalar outros hooks nem
ler rede. IDs já registrados não são sobrescritos. Um tema salvo de addon é
restaurado quando seu registro chega; se não estiver disponível, usa o clássico.

## Scoreboard

TAB abre o placar e soltar TAB fecha, usando os hooks existentes do gamemode.
O teclado fica disponível para o jogo e o cursor permite silenciar outros jogadores.
O placar agrupa humanos, zumbis e espectadores; mostra nome, pontos do gamemode,
mortes, estado e ping. Pontos continuam sendo `GetPoints()`, sem substituir por kills.
O jogador local recebe uma marca na linha. **ON** significa áudio habilitado;
**OFF**, silenciado localmente. A ação não altera permissões ou estado no servidor.

A lista é atualizada a cada 0,5s enquanto aberta, inclusive mudanças de equipe
com a mesma quantidade de jogadores. Ordena por pontos decrescentes, depois nome
e ID. Atualizações de ping, estado e áudio mantêm os painéis e a rolagem; mudanças
de composição/ordem da lista, resolução ou tema reconstroem a apresentação necessária.
Não há nova mensagem de rede nem nova persistência de dados.

`ZPScoreboard:GetState()` entrega dados novos, sem referências a Player: `Open`,
`Theme`, `Width`, `Height` e `Teams`. Cada grupo contém `ID`, `Label` e `Players`;
cada jogador contém `ID`, `Name`, `Points`, `Deaths`, `Ping`, `Status`, `Local`,
`CanMute`, `Muted` e `CanViewProfile`. `Status` é `alive`, `dead` ou `spectating`.
O ID usa [Player:UserID](https://wiki.facepunch.com/gmod/Player:UserID), que identifica
a conexão, inclusive bots. A ação revalida o jogador antes de silenciar.

O tema pode declarar `CreateScoreboard`, uma factory sem `self`, que retorna
métodos com `self`: `Open(state, actions)`, `Update(state)` e `Destroy()`.
A apresentação pode chamar `actions:ToggleMute(id)` e `actions:ViewProfile(id)`. Clicar no nome abre um dropdown com a opção de perfil da Steam, desabilitada para bots. O controlador revalida a conexão antes de abrir o perfil; o dropdown é removido ao fechar ou trocar o tema. O ciclo de TAB e o timer
pertencem ao controlador. Para reaproveitar o visual padrão com uma nova paleta:

```lua
CreateScoreboard = function()
    return ZPCreateScoreboardHUD(minhaPaleta, "classic") -- ou "hl2" / "cs16"
end,
```

Sem essa factory, addons antigos recebem o layout padrão com a paleta do próprio
tema. Trocar `zp_theme` com o placar aberto troca seu visual imediatamente.
As APIs de abertura e fechamento seguem [ScoreboardShow](https://wiki.facepunch.com/gmod/GM:ScoreboardShow)
e [ScoreboardHide](https://wiki.facepunch.com/gmod/GM:ScoreboardHide).

## Prévias e validação

| Tema | HUD | Menu | Scoreboard |
| --- | --- | --- | --- |
| Clássico | [Prévia](previews/hud-classic.svg) | [Prévia](previews/weapon-menu-classic.svg) | [Prévia](previews/scoreboard-classic.svg) |
| Half-Life 2 | [Prévia](previews/hud-hl2.svg) | [Prévia](previews/weapon-menu-hl2.svg) | [Prévia](previews/scoreboard-hl2.svg) |
| Counter-Strike 1.6 | [Prévia](previews/hud-cs16.svg) | [Prévia](previews/weapon-menu-cs16.svg) | [Prévia](previews/scoreboard-cs16.svg) |

`npm run preview:weapons` captura os callbacks reais do Lua compilado em SVG,
com dados simulados. As imagens não são capturas do motor. Os testes cobrem troca
sem repetir pedidos, persistência/fallback, armas sem carregador, dois canais de
munição, espectador e limites de tela em 640×480, 1280×720, 1920×1080 e 2560×1080.
Fontes, aparência, comportamento das armas de addons e composição com VGUI ainda
precisam ser conferidos dentro do Garry's Mod.
