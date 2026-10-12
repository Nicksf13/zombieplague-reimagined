# POC: seleção de armas com HUD substituível

Esta POC conecta a escolha de armas às regras existentes do gamemode. O servidor
fornece dados e valida escolhas; um controlador mantém o estado no cliente;
apresentações independentes desenham e chamam ações. Não restaura o menu antigo.

## Experimentar no Garry's Mod

Depois de compilar e instalar o gamemode atualizado no servidor/cliente:

1. Abra o menu principal com **F4** e clique em **Armas**. `zp_weapons` no console
   e `/weapons` no chat abrem diretamente o seletor; `zp_menu` abre o principal.
2. Escolha primária, secundária ou corpo a corpo e clique em uma arma.
3. A seleção destacada muda somente depois da confirmação do servidor.
4. Abra **F4 > Configurações > Aparência** para trocar o tema do menu, HUD e placar.
5. Feche com ESC ou X; F4 volta ao menu principal. O botão Atualizar consulta novamente o servidor.

Os comandos `zp_weapon_hud_classic`, `zp_weapon_hud_hl2` e `zp_weapon_hud_cs16` também selecionam
um tema e abrem o seletor. `zp_theme classic|hl2|cs16` troca só o tema, sem abrir o menu.
F4 é o default do evento `MainMenu` em `KeyManager`, no grupo
`ZombiePlagueActions`. Uma tecla salva de `WeaponMenu` migra para esse evento.
O cursor fica disponível para escolher e o teclado continua disponível para
movimentação. Mirar/disparar com o mouse enquanto interage não é uma promessa da POC.
O tema também desenha vida, colete, status, timer e munição primária/secundária,
com posições definidas pelo próprio tema. O scoreboard continua ativo.
Veja o [contrato de temas](themes.md) para adicionar um conjunto completo.

### Seleção automática no spawn

Após o loadout de um spawn humano normal, o servidor verifica as escolhas salvas
e solicita a primeira categoria ausente: primária, secundária e corpo a corpo.
Categorias sem armas habilitadas são puladas. Bots, espectadores, zumbis e
sobreviventes não recebem essa abertura automática.

Cada escolha confirmada pelo servidor avança para a próxima categoria ausente;
ao completar todas, o seletor fecha. Fechar manualmente cancela essa sequência,
e respostas pendentes não reabrem a interface. Morrer ou virar zumbi também
fecha a sequência. A abertura manual permite navegar e alterar escolhas livremente.
O pé de cabra inicial é preservado como fallback, sem contar como escolha salva
nem consumir o direito à primeira escolha corpo a corpo naquela vida.

### Opções do menu principal

O principal lista opções registradas e disponíveis; inicialmente há **Armas** e **Configurações**.
Um addon cliente pode registrar outra opção após a inicialização do gamemode:

```lua
ZPMainMenu:RegisterOption({
    ID = "meu_menu",
    Label = "Meu menu",
    Description = "Abrir meu componente",
    IsVisible = function() return true end, -- opcional; reavaliado com o menu aberto
    Action = function() MeuComponente:Open() end,
})
```

IDs duplicados são ignorados. A disponibilidade é verificada novamente no clique.
Essa condição só controla a interface; permissões e ações de gameplay continuam
sendo validadas pelo servidor do componente. O menu principal não envia rede.

### Bots para iniciar uma partida de teste

Crie uma partida local **multiplayer**, com pelo menos 2 vagas (por exemplo, 8).
O modo singleplayer não permite bots, pois cada bot ocupa uma vaga de jogador,
conforme [player.CreateNextBot](https://wiki.facepunch.com/gmod/player.CreateNextBot).
Você pode ficar sozinho no servidor multiplayer e preencher as outras vagas com bots.

No console, use `zp_addbot` para um bot ou `zp_addbot 3` para três. No chat,
`/bot` e `/bot 3` fazem o mesmo. O acesso exige superadmin; o console do servidor
também pode executar o comando. A quantidade deve ser inteira de 1 a 16 e a
criação respeita as vagas restantes. `BOT_MODE` precisa estar ativo, como no default.

Os bots são Players registrados explicitamente no `RoundManager`, contam para
`zp_min_players` (default 2) e seguem os timers e spawns normais. Só os bots criados
por esse comando têm movimento, botões e impulsos de entrada limpos; continuam
sujeitos a física, dano e conversão de equipe. Não há IA de combate ou navegação.

## Prévias reproduzíveis

- Menu principal: [Clássico](previews/main-menu-classic.svg),
  [Half-Life 2](previews/main-menu-hl2.svg) e [CS 1.6](previews/main-menu-cs16.svg).
- [Clássico: categorias laterais e lista](previews/weapon-menu-classic.svg).
- [Half-Life 2: categorias no topo e cartões](previews/weapon-menu-hl2.svg).
- [Counter-Strike 1.6: painel verde e lista compacta](previews/weapon-menu-cs16.svg).

`npm run preview:weapons` executa os callbacks `Paint` do Lua gerado com as mesmas
simulações dos testes e captura as primitivas em SVG. Os dados são exemplos de
armas nativas. As imagens não são capturas do motor; fontes, interação, scroll e
composição real precisam ser conferidos no GMod. Recompile antes de regenerar.

## Responsabilidades e arquivos

Fontes sob `src/gamemodes/zombieplague/gamemode/menus/`:

| Arquivo | Responsabilidade |
| --- | --- |
| `shared/sh_weapon_menu_protocol.ts` | Validar versão, IDs, escolhas e respostas em runtime. |
| `server/sv_weapon_menu.ts` | Catálogo por jogador, validação, limite de pedidos e integração com Player. |
| `client/cl_weapon_menu.ts` | Estado, navegação, pedidos pendentes e ciclo de vida das apresentações. |
| `client/cl_weapon_menu_hud.ts` | Três apresentações e paletas compartilhadas com os temas do HUD. |
| `client/cl_main_menu.ts` | Registro de opções, disponibilidade e navegação do principal. |
| `client/cl_main_menu_hud.ts` | Apresentação padrão do principal, com a paleta do tema. |

Os contratos estão em `types/weapon-menu.d.ts` e `types/client/weapon-menu.d.ts`.
Os caminhos Lua são registrados em `migration.json`, com include e distribuição
explícitos. Não há imports de runtime nem nova dependência de addon ou assets.

## Contrato público para outros HUDs

`ZPWeaponMenu:RegisterPresentation(id, factory)` registra uma factory Lua sem
`self`, que retorna um objeto com estes métodos com `self`:

```lua
ZPWeaponMenu:RegisterPresentation("meu_hud", function()
    return {
        Open = function(self, state, actions)
            self.actions = actions
            self:Update(state)
            -- Criar painéis ou instalar o HUDPaint próprio.
        end,
        Update = function(self, state)
            self.state = state
            -- Atualizar a apresentação a partir dos dados recebidos.
        end,
        Destroy = function(self)
            -- Remover todos os painéis e hooks instalados por esta apresentação.
            self.actions = nil
            self.state = nil
        end,
    }
end)
ZPWeaponMenu:UsePresentation("meu_hud")
```

O exemplo mostra o ciclo de vida; o desenho pertence ao autor. Carregue o addon
depois de o gamemode instalar `ZPWeaponMenu`, por exemplo em `InitPostEntity`, e
distribua seu código de cliente normalmente. IDs já registrados não são substituídos.

`state` contém `Open`, `Category`, `Presentation`, `Pending`, `Feedback` e,
quando disponível, `Snapshot`. `Feedback` é uma chave de localização nativa.
O snapshot contém `Entries`, `Selected`, `CanReceive` e `Truncated`. Entradas
contêm somente `ID`, `Name` literal, `Kind` e `Order`; nunca recebem instâncias
de armas, callbacks de servidor ou coordenadas. Os dados entregues são cópias.

`actions` oferece `SetCategory(kind)`, `Select(id)`, `Refresh()`, `Close()` e
`UsePresentation(id)`, todos com `self`. Categorias estáveis: `primary`,
`secondary` e `melee`. Um clique chama `actions:Select(id)`; o desenho pode
ordenar, pesquisar e paginar localmente sem usar índices como identificação.

A factory recebe uma nova instância a cada abertura/troca. O controlador chama
`Destroy` ao fechar ou substituir a apresentação. Trocar HUD preserva catálogo,
categoria, seleção confirmada e pedido pendente, sem tráfego adicional.
Fechar não cancela uma ação já enviada, e sua resposta nunca reabre o HUD.
`GetState()` permite consultar uma cópia do estado sem depender dos painéis.

## Rede e comportamento

Protocolo versão 1:

- `ZPWeaponMenuOpen`: servidor pede abertura, sem dados, usado pelo chat.
- `ZPWeaponMenuMissing`: servidor envia uma string de categoria após o spawn;
  o cliente valida o valor e inicia a sequência de escolhas ausentes.
- `ZPWeaponMenuCatalog`: cliente envia versão UInt8 e RequestID UInt31.
- `ZPWeaponMenuSelect`: cliente envia `{Version, RequestID, Kind, ID}`.
- `ZPWeaponMenuReply`: servidor responde `{Version, RequestID, Code, Snapshot?}`.

`catalog`, `saved` e `issued` incluem snapshot confirmado. `invalid_weapon` e
`rate_limited` encerram o pedido sem substituir os dados anteriores. `issued`
significa que havia direito à entrega e a arma está no inventário após o setter;
`saved` confirma a preferência sem afirmar que houve entrega. Não se altera preço,
balanceamento nem registro de armas. A abertura automática observa o spawn
depois do loadout, sem criar um spawn adicional.

Escolhas são salvas em qualquer estado. A entrega continua limitada a humano
vivo, uma vez por categoria por vida, usando os setters existentes de Player.
Um ID desconhecido, uma arma de outra categoria ou desabilitada é rejeitado.
O ID do jogador vem do remetente fornecido pelo motor, nunca do payload.

O servidor limita a um pedido a cada 0,2s por jogador e retém os 16 últimos
resultados de seleção para evitar reexecução de pedidos recentes. A memória
é limpa na desconexão. Payloads de seleção maiores que 4.096 bits são descartados
antes de ler a tabela. O catálogo é limitado a 256 entradas e orçamento
conservador de 48 KB; ao exceder, informa `Truncated` na interface.

## Limites deliberados e validação

- O catálogo é atualizado ao abrir, confirmar uma seleção ou pedir Atualizar.
  Não há consulta de rede por frame; o spawn inicia a sequência, e o servidor
  sempre revalida a escolha quando ela chega.
- Após 5s sem resposta, o cliente indica falta de confirmação e permite atualizar.
  Respostas de pedidos anteriores são ignoradas. Não se presume falha da ação.
- A escolha fica salva no Player durante a sessão, conforme o comportamento
  existente; não adiciona persistência entre reconexões.
- O tema fica salvo em `data/zombieplague/theme.json`. Apresentações avulsas de
  addons continuam restritas à sessão. Hot reload, paginação de catálogos maiores e recuperação de falhas em
  apresentações de terceiros ficam para a evolução do contrato.
- Esta etapa cobre apenas armas. Classes, compra de itens, votação e admin ainda
  precisam de contratos próprios antes de integrar seus componentes ao HUD.

`npm run build` valida Lua 5.1. `npm test` cobre servidor e cliente simulados,
entrega/salvamento nas três categorias, rejeições, repetição de pedidos, timeout,
troca de HUD, isolamento do estado e limpeza dos painéis. A validação de rede,
entrada, distribuição, scroll e aparência no motor permanece pendente.

Referência de entrada: a [documentação de Panel:SetMouseInputEnabled](https://wiki.facepunch.com/gmod/Panel%3ASetMouseInputEnabled)
descreve o uso de `SetKeyboardInputEnabled(false)` depois de `MakePopup` para
permitir movimentação. ESC é observado pelo controlador; o hook de painel
[OnKeyCodePressed](https://wiki.facepunch.com/gmod/PANEL%3AOnKeyCodePressed) não o recebe.
As entradas da lista usam [Panel:Add](https://wiki.facepunch.com/gmod/Panel%3AAdd)
para integrar o canvas do `DScrollPanel`.
