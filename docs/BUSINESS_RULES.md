# Ohel 2.0 — Regras de Negócio e Arquitetura Multi-Contexto

> Última atualização: 2026-09-19. Este documento existe pra alguém (você, outro dev, ou uma IA numa sessão nova, com zero contexto) conseguir retomar o projeto sem reler nenhuma conversa antiga. Sempre que uma decisão de produto ou uma correção técnica for tomada, ela deve ser registrada aqui — não só lembrada.

## Como retomar o trabalho numa sessão nova

Este projeto costuma ser trabalhado em rodadas curtas (créditos de IA limitados) e, entre uma rodada e outra, o projeto pode continuar sendo mexido por fora (Google AI Studio, outra sessão). Ou seja: **é normal e esperado que o código já esteja diferente do que uma sessão anterior deixou.** Pra qualquer IA que for continuar isso:

1. Leia este documento inteiro antes de tocar em qualquer arquivo.
2. Não assuma que um arquivo está do jeito que este documento descreve — **confira o código de verdade primeiro** (ele é a fonte da verdade; este documento pode estar um passo atrasado).
3. Se algo no código não bater com o que está escrito aqui, é sinal de que alguém mexeu por fora — revise esse trecho com o mesmo cuidado que revisaria código de outra pessoa (funciona? é consistente com o resto? tem bug?), e **atualize este documento** para refletir o estado real antes de construir em cima dele.
4. Ao terminar uma rodada de trabalho, sempre atualize a seção 15 (Changelog) e qualquer seção afetada — não deixe esse trabalho pra "próxima vez".

---

## 1. Visão geral

O Ohel organiza a vida da pessoa em **4 pilares** (Familiar, Financeiro/Profissional, Físico/Pessoal, Espiritual), e cada pessoa pode transitar entre até três tipos de "espaço":

| Espaço | O que é | Quem paga |
|---|---|---|
| **Pessoal** | O que só diz respeito a você (saúde, humor, hábitos) | — (sem plano próprio; recursos Plus vêm da Casa) |
| **Casa** (Household) | Uma família/lar — cônjuge, filhos, agregados | O dono da Casa |
| **Instituição** (Institution) | Empresa, igreja, ONG — qualquer CNPJ | O dono da Instituição |

**Uma mesma pessoa pode acumular vários papéis ao mesmo tempo**: dono de uma Casa, dono de duas Instituições diferentes (ex: igreja + empresa), membro comum de uma terceira. A troca entre esses papéis é feita por um **seletor de perfil estilo Netflix** (`ContextSwitcher.tsx`) — nunca é login separado, é o mesmo usuário trocando de "chapéu". O contexto ativo (`activeContextType` + `activeContextId`, vindos de `useAuth()`) determina o que aparece em quase toda tela do app.

---

## 2. Mapa de arquivos — onde cada coisa vive

| Área | Arquivo(s) |
|---|---|
| Modelo de dados (fonte da verdade dos tipos) | `src/types.ts` |
| Regras de segurança do Firestore | `firestore.rules` |
| Índices compostos necessários | `firestore.indexes.json` |
| Backend Express (rotas `/api/*`) | `server.ts` |
| Autenticação, memberships, contexto ativo | `src/context/AuthContext.tsx` |
| Tela de login/cadastro | `src/components/AuthSelector.tsx`, `src/components/Login.tsx` |
| Seletor de perfil (Netflix-style) | `src/components/ContextSwitcher.tsx` |
| Painel "adicionar token / gerenciar casa" | `src/components/ConnectionsSettings.tsx` |
| Gestão da Casa (convite, membros, papéis, ranking) | `src/components/HouseholdPanel.tsx` |
| Gestão da Instituição (convite, aprovação, ranking) | `src/components/InstitutionPanel.tsx` + `src/components/institution/*` |
| Grupos institucionais com permissão | `src/components/institution/GroupManagement.tsx` |
| Formulário de tarefa (contexto, delegação) | `src/components/TaskForm.tsx` |
| Dashboard principal | `src/components/Dashboard.tsx` |
| Agenda em grade de horário | `src/components/DayTimelineView.tsx` |
| Ranking por contexto | `src/components/RankingView.tsx` |
| Conexões externas temporárias por pilar | `src/components/PillarConnectionsPanel.tsx` |
| Cores por pilar | `src/lib/pillarTheme.ts` |
| Gating de recursos Plus | `src/hooks/usePlanFeatures.ts` |
| Migração de dados legados | `scripts/migrate-to-multi-context.ts` |
| App raiz / providers | `src/main.tsx` |
| App shell (sidebar, roteamento de views, addTask) | `src/App.tsx` (⚠️ arquivo enorme, ~2500 linhas — mude com cirurgia, não com refatoração ampla) |

---

## 3. Modelo de dados — coleções do Firestore

### `households/{id}`
```ts
{ id, name, ownerId, inviteCode, planType: 'PERSONAL_BASIC'|'PERSONAL_PLUS',
  subscriptionStatus?, trialEndsAt?, rankingEnabled?, createdAt }
```
Subcoleção `households/{id}/members/{userId}`:
```ts
{ householdId, userId, profileName, role: 'OWNER'|'ADULT'|'CHILD'|'GUEST',
  permissions?: HouseholdPermission[], status: 'ACTIVE'|'PENDING', joinedAt }
```
- `HouseholdPermission` = `'ASSIGN_TASKS_TO_OTHERS' | 'APPROVE_TASKS' | 'VIEW_FINANCE' | 'MANAGE_FINANCE' | 'MANAGE_MEMBERS'`
- Defaults por papel (`HOUSEHOLD_ROLE_DEFAULTS` em `types.ts`): `OWNER` tem todas; `ADULT` tem `ASSIGN_TASKS_TO_OTHERS`, `APPROVE_TASKS`, `VIEW_FINANCE`; `CHILD`/`GUEST` não têm nenhuma por padrão.

### `institutions/{id}`
```ts
{ id, name, ownerId, inviteCode, planType: 'INSTITUTION_BASIC'|'INSTITUTION_PLUS',
  hasAdminDiscount?, trialEndsAt?, subscriptionStatus?, rankingEnabled?,
  taskApprovalRequired?, createdAt }
```
Subcoleção `institutions/{id}/members/{userId}`: `{ institutionId, userId, role: 'ADMIN'|'MANAGER'|'MEMBER', status, joinedAt }`.
**Papel é sempre lido deste documento, nunca de um claim de token** — uma pessoa pode ter papéis diferentes em instituições diferentes.

### `groups/{id}` (institucional)
```ts
{ id, name, institutionId, members: string[], permissions?: GroupPermission[] }
```
`GroupPermission` = `'VIEW_CALENDAR' | 'VIEW_FINANCE' | 'MANAGE_FINANCE' | 'APPROVE_TASKS' | 'MANAGE_MEMBERS'`.

### `tasks/{id}`
Campos relevantes pro modelo multi-contexto (o resto do schema de `Task` já existia antes):
```ts
{ userId,          // sempre quem CRIOU a tarefa — nunca muda pro destinatário
  contextType: 'PERSONAL'|'HOUSEHOLD'|'INSTITUTION',
  contextId: string | null,
  assignedTo?: string[],       // destinatário(s) — é assim que a tarefa "aparece" pra outra pessoa
  assignedToGroups?: string[],
  assignedBy?: string,          // preenchido só quando assignedTo/assignedToGroups não é vazio
  status: '...' | 'PENDING_APPROVAL' | 'COMPLETED' | ... }
```
A consulta do app já faz `where(userId==me) OR where(assignedTo array-contains me)` — é assim que uma tarefa delegada aparece na agenda de quem recebeu.

### `rankings/{contextType}_{contextId}_{userId}_{weekId}`
```ts
{ userId, userName, contextType, contextId, weekId, points }
```
**Só o servidor escreve** (`POST /api/rankings/award`) — regra do Firestore bloqueia escrita de cliente. Precisa do índice composto em `firestore.indexes.json`.

### `pillar_connections/{ownerId}_{targetUserId}_{pillar}`
```ts
{ ownerId, targetUserId, pillar: PillarKey, scope: 'READ_ONLY',
  status: 'PENDING'|'ACTIVE'|'REVOKED', expiresAt: number, createdAt }
```
`PillarKey` = `'PESSOAL' | 'FINANCEIRO' | 'FAMILIAR' | 'PROFISSIONAL' | 'ESPIRITUAL'`. ID do doc já embute quem/quem/qual-pilar — checagem de acesso é um `get()` único, sem query. Expira sozinho (`expiresAt > request.time` checado na hora da leitura).

### Coleções de pilar pessoal (finance_transactions, personal_finance, spiritual_*, fitness_habits, personal_family, personal_album, personal_documents, wellbeing_logs, ...)
Todas ganharam (ou podem ganhar) estes campos opcionais, checados por `canReadPillarDoc()`/`canWritePillarDoc()` no `firestore.rules`:
```ts
{ userId, contextType?: 'PERSONAL'|'HOUSEHOLD'|'INSTITUTION', contextId?: string,
  visibility?: 'PRIVATE'|'PUBLIC'|'SPECIFIC', visibleToUsers?: string[] }
```
- `PRIVATE` (padrão/ausente) = só dono. `PUBLIC` + contexto = todo mundo daquele contexto. `SPECIFIC` = só quem está em `visibleToUsers`.
- **Exceção proposital**: `wellbeing_logs` nunca aceita `PUBLIC`/contexto — só dono ou `pillar_connections` ativa.
- **Recursos Plus** (`personal_album`, `personal_documents`, criação de `task_templates`) checam `contextHasPlusFeature()` antes de deixar criar.

### `notifications/{id}`
Ganhou `senderId?`, `contextType?`, `contextId?` — notificar alguém que não seja você mesmo exige provar (na regra) que vocês compartilham aquele contexto.

### `missions/{id}`
Ganhou `institutionId` obrigatório pra leitura ser restrita a membros daquela instituição (antes: qualquer logado lia tudo — brecha corrigida).

---

## 4. Planos e recursos

- `PlanType` = `'PERSONAL_BASIC' | 'PERSONAL_PLUS' | 'INSTITUTION_BASIC' | 'INSTITUTION_PLUS'` (mais um `LegacyPlanType` só pra compatibilidade com dados antigos de 3 níveis, ver `types.ts`).
- `PlanFeature` = `'VIDEO_CALLS' | 'TASK_TEMPLATES' | 'ATTACHMENTS' | 'PHOTO_ALBUM'` — todos exclusivos do Plus (Pessoal ou Institucional).
- **O plano é do contexto (Casa/Instituição), nunca da pessoa.** `household.planType` / `institution.planType` é a fonte da verdade; qualquer membro daquele contexto herda os recursos.
- Front: `usePlanFeatures()` centraliza a checagem, considerando também `viewAsPlanOverride` (simulação do root).
- Back: `contextHasVideoCallFeature()` em `server.ts` reconfirma antes de emitir token de vídeo — nunca confia só no front.

## 5. Tarefas e delegação — regras exatas

1. Delegar (`assignedTo`/`assignedToGroups` não vazio) exige `assignedBy == request.auth.uid` **e**:
   - `HOUSEHOLD`: criador precisa ter `ASSIGN_TASKS_TO_OTHERS` no seu member doc daquela casa.
   - `INSTITUTION`: criador precisa ser membro; se `institution.taskApprovalRequired`, a tarefa **precisa** nascer com `status: 'PENDING_APPROVAL'`.
   - `PERSONAL`: delegação nunca é permitida (sem estrutura de permissão pra checar contra).
2. **Bug já corrigido, não reintroduzir**: como `userId` é sempre o criador (nunca o destinatário), uma regra que só checa `incoming().userId == request.auth.uid` pra "autorizar criação" está sempre satisfeita e **não pode** ser usada como cláusula de autorização de delegação. A checagem de delegação precisa rodar **independentemente** disso — ver `isDelegatedTask()` em `firestore.rules`.
3. Casa nunca força aprovação (decisão de produto, não é limitação técnica).

## 6. Ranking

- Um doc por `(contextType, contextId, weekId)` por usuário — nunca soma Casa com Instituição.
- Precisa ser ligado pelo dono (`rankingEnabled`).
- Pontos só entram via `POST /api/rankings/award`, chamado pelo front logo depois de marcar uma tarefa como concluída (`handleTaskComplete` em `App.tsx`). O endpoint busca a tarefa, confere contexto/`rankingEnabled`/quem é o executor, e só então incrementa — o cliente nunca escreve o número direto.

## 7. Conexões externas por pilar

- Pra alguém **fora** de qualquer Casa/Instituição do dono (médico, contador).
- Fluxo: dono informa e-mail + pilar + prazo → doc `PENDING` → pessoa aceita → `ACTIVE` → expira sozinho.
- Alternativa sem convite nenhum: exportar o pilar como JSON e mandar manualmente (botão no mesmo painel).

## 8. Root / Admin da plataforma

- E-mail root: `marcelle.gomesvieira.ayres@gmail.com` (ver `isPlatformAdmin()` no `firestore.rules` — também aceita um claim `admin`/`isPlatformAdmin` no token, ou doc em `admins/{uid}`, pra não depender só do e-mail hardcoded no futuro).
- Visão global: `GlobalPlatformDashboard.tsx` + `GET /api/admin/global-summary`.
- Simulação de plano (`viewAsPlanOverride`, em `ConnectionsSettings.tsx`): **só afeta o que a UI mostra pro próprio root**, nunca cobrança real nem limites de verdade no backend.

## 9. Login / Onboarding

Três caminhos em `AuthSelector.tsx`:
1. **Código de convite** → `POST /api/invite/validate` detecta sozinho se é `HOUSEHOLD` ou `INSTITUTION` (olha as duas coleções) e devolve `{ type, id, name, planType }`.
2. **Criar conta CPF** → nova Casa, escolhe Básico/Plus.
3. **Criar conta CNPJ** → nova Instituição, escolhe Básico/Plus.

Depois de já ter conta: `POST /api/institution/join` (autenticado) ou o fluxo equivalente de Casa, acessível em Configurações → "Casas e Instituições" (`ConnectionsSettings.tsx`), pra vincular mais um código sem recriar conta.

## 10. Endpoints do backend (`server.ts`) relevantes pro modelo multi-contexto

| Rota | Autenticado? | O que faz |
|---|---|---|
| `POST /api/invite/validate` | Não | Detecta Casa vs Instituição por código |
| `POST /api/institution/join` | Sim | Adiciona membership de instituição a uma conta já existente (sempre `role: MEMBER`) |
| `POST /api/stream-token` | Sim | Emite token de vídeo — **recusa se o contexto não é Plus** ou se quem pede não pertence a ele |
| `POST /api/rankings/award` | Sim | Único jeito de pontos entrarem em `rankings` |
| `POST /api/admin/set-claim`, `POST /api/admin/sync-admin-claims`, `GET /api/admin/global-summary` | Sim (admin) | Gestão de claims e visão global — **exigem auth real, não confiar em body não verificado** (isso já foi uma vulnerabilidade corrigida, ver seção 15) |

## 11. Frontend — decisões visuais

- **Cor por pilar**: Familiar=roxo, Físico=verde, Financeiro/Profissional=esmeralda(pessoal)/azul(institucional), Espiritual=vermelho — vem de `OrdemNoCaos.tsx`, reaplicado via `getPillarAccentStyle()` (`src/lib/pillarTheme.ts`) que sobrescreve a CSS var `--primary` no wrapper da view ativa.
- **Tema escuro é o padrão** (`ThemeProvider defaultTheme="dark"`), paleta navy/azul já definida em `src/index.css` antes mesmo do redesign de 2026-09-19.
- **Redesign 2026-09-19** (inspirado num print de referência): hero com glow radial + pílulas de estatística no header do Dashboard; sidebar com item ativo em pílula azul sólida; card "Próximos Eventos"; agenda em grade com cor variando por evento (vermelho reservado pra urgência real). O mesmo tratamento (`relative overflow-hidden` no Card + `div` decorativo `absolute -top-24 -right-24 blur-3xl` + lembrar `relative` também em `CardHeader`/`CardContent`, senão o glow pinta por cima do conteúdo) foi estendido a `InstitutionPanel.tsx`, `HouseholdPanel.tsx` e `RankingView.tsx`.
- **De propósito, sem imagem/foto real de fundo** — glow em CSS puro, não uma foto de banco de imagens, pra não trazer risco de direito autoral num app distribuído.
- **`MotionConfig reducedMotion="user"`** em `main.tsx` — toda animação do Framer Motion respeita a preferência de "reduzir movimento" do sistema operacional automaticamente.
- **(2026-09-20) Ctrl+K/Cmd+K funcional**: `CommandPalette.tsx` (novo) — busca módulos da sidebar, tarefas não concluídas e pessoas, navegação por seta+Enter, sem biblioteca nova (`cmdk` etc.), só `Dialog` + estado local. Listener global em `App.tsx` (`window.addEventListener('keydown', ...)`), e o campo de busca do header também abre a paleta ao ganhar foco (`onFocus`).
- **(2026-09-20) Ilustração original da "tenda"**: `src/components/illustrations/TentNightIllustration.tsx` — SVG desenhado à mão (montanhas, estrelas, tenda com brilho de lanterna escapando pela entrada), usado como camada decorativa no header do Dashboard (`Dashboard.tsx`), com `mask-image` pra sumir gradualmente do lado do texto. **Decisão deliberada**: não usei uma foto real de banco de imagens (risco de direito autoral num produto distribuído) — isso é arte original, então pode ficar no produto sem restrição. O laranja/dourado da lanterna é intencionalmente o único detalhe não-azul da tela — é elemento de ilustração, não virou cor de UI (mantém a identidade azul/grafite única pedida em 2026-09-20).

## 12. Acessibilidade — estado conhecido

**OK, verificado:**
- Navegação por teclado em: `DayTimelineView` (tarefas), `GroupManagement` (linhas de permissão/membro — `role="checkbox"`, `tabIndex`, `onKeyDown`).
- `MotionConfig reducedMotion="user"`.
- Diálogos com `DialogTitle`; formulários com `Label` associado a `Input`.
- `alt` presente nos `<img>` de `App.tsx` (logo) e `Dashboard.tsx` (avatar).

**Pendente — não corrigido ainda:**
- `<img>` sem `alt` em `LibraryModule.tsx`, `PersonalModule.tsx`, `ProfessionalModule.tsx` (não auditados de ponta a ponta ainda).
- Contraste de ícones coloridos (`bg-cor-500/10 text-cor-500`) é baixo no **tema claro** especificamente — padrão usado em dezenas de lugares desde antes desta arquitetura; precisa de uma decisão de token de cor (ex: `600`/`700` no claro) aplicada de uma vez, não corrigida pilar por pilar.
- Nenhuma medição com ferramenta real (axe, Lighthouse) foi feita — tudo acima é leitura de código, o ambiente de trabalho usado não tinha navegador disponível.

## 13. Pendências / Backlog

- Nenhum item de frontend pendente no momento (ver seção 11).
- Nenhum teste automatizado existe no projeto (não existia antes desta arquitetura também).
- `usePermissions.ts` (hook antigo) ainda lê papel institucional de forma legada (via claim) em alguns pontos da UI — o `firestore.rules`, que é quem realmente protege os dados, já foi corrigido; só a UI que ainda não foi 100% alinhada. Não é um risco de segurança, é só uma UI que pode mostrar/esconder botões de forma levemente desatualizada.
- Auditoria de acessibilidade real (com ferramenta, não leitura de código) e correção sistemática do contraste em modo claro.

## 14. Como rodar / checklist antes de produção

```bash
npm install
npm run dev            # testar localmente
tsc --noEmit           # type-check — nunca foi rodado neste projeto durante as sessões de IA até agora
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes   # necessário pro RankingView funcionar
npx tsx scripts/migrate-to-multi-context.ts --dry-run   # ver o que mudaria
npx tsx scripts/migrate-to-multi-context.ts --apply     # migrar dados antigos de fato
```
Variáveis de ambiente: ver `.env.example` na raiz — nenhuma credencial real deve estar hardcoded em `vite.config.ts` (isso já foi uma vulnerabilidade corrigida, ver seção 15).

## 15. Changelog / correções de segurança já feitas (não reintroduzir)

- **`/api/admin/set-claim` e `/api/admin/sync-admin-claims` sem autenticação real** — qualquer um podia se autopromover a admin. Corrigido: exige token verificado.
- **`isManager()`/`isAdmin()` lidos de um claim único no token** — quebrava com múltiplas instituições. Corrigido: sempre lido do doc `institutions/{id}/members/{uid}`.
- **`missions` legível por qualquer logado** (vazava dados entre instituições diferentes). Corrigido: exige `isMemberOf(institutionId)`.
- **`messages` legível por qualquer "manager" global**, não só participantes da conversa. Corrigido: exige participação real na tarefa/grupo.
- **`notifications.create` aberto pra qualquer logado escrever em qualquer inbox**. Corrigido: exige contexto compartilhado comprovado, exceto auto-notificação.
- **Credenciais reais (chave Firebase, e-mail admin) hardcoded como fallback em `vite.config.ts`**. Removidas — variável vazia se não configurada, falha visível em vez de vazar segredo.
- **Regra de delegação de tarefa inalcançável** (ver seção 5, item 2) — corrigida com `isDelegatedTask()`.
- **Planos de 3 níveis → 2 níveis** — migração em `scripts/migrate-to-multi-context.ts`.

## 16. Nota sobre o processo de trabalho

Este projeto é frequentemente trabalhado em sessões de IA com créditos limitados, intercaladas com edições feitas por fora (Google AI Studio ou similar). Isso já causou, mais de uma vez, código aparecer alterado entre uma mensagem e outra sem uma edição correspondente ter sido feita na conversa. **Isso é esperado e não é motivo de alarme** — mas toda sessão nova deve:
1. Comparar o estado atual do código com o que este documento descreve;
2. Revisar com cuidado qualquer trecho que não bata (pode estar certo, mas precisa ser conferido antes de se apoiar nele);
3. Atualizar este documento pra refletir a realidade, antes de seguir construindo em cima.
