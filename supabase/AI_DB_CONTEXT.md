# AI DB Context — Showroom (site público + curadoria /admin)

Este sistema **não é um projeto Supabase separado**. Ele usa o mesmo projeto central do
resto do ecossistema Lucenera. Migrations novas nascem em `supabase/db/migrations/` do
**repositório central** (`ADAPTA-PASS-Lucenera`), nunca dentro de uma pasta
`04-Sistemas/showroom-qtq8er2dk/supabase/migrations/` local. A fonte de verdade de schema é
`supabase/db/current/` no repo central — mas ver "Achado" abaixo, hoje está desatualizado
para este domínio.

Este arquivo não existia até a SPEC-148 (gap desde a SPEC-125) — criado agora cobrindo tudo
que já estava aplicado (migrations 126/127/128/137) mais o que a SPEC-148 acrescenta.

## Cliente Supabase: sempre anônimo

`src/lib/supabase/client.ts` usa só a chave anônima (`VITE_SUPABASE_PUBLISHABLE_KEY`). Este
sistema **nunca** usa Supabase Auth — não existe sessão `authenticated`, só `anon`, tanto no
site público quanto na tela `/admin`. O "login" de `/admin` é uma RPC que confere
usuário/senha contra hash guardado em `showroom_config`, sem criar sessão. Qualquer RPC ou
policy pensada para este sistema precisa funcionar com role `anon`.

## Tabelas e colunas específicas do showroom

- **`produtos.imagem_showroom_url text`** — foto exibida na vitrine (nullable).
- **`produtos.estoque_showroom int`** — estoque específico do showroom (distinto de
  `estoque_total`/`estoque_disponivel`, que são do domínio Estoque/Compras).
- **`produtos.codigo_produto int`** — identificador único (`produtos_codigo_produto_key`),
  usado nas rotas públicas (`/peca/:codigo`) e em todas as RPCs `showroom_*`.
- **`showroom_config`** (migration 125/128) — `chave text primary key, valor text` — guarda
  `admin_user` e `admin_pass_hash` (bcrypt via `pgcrypto`). RLS on, sem policy — só lida pela
  função interna `showroom_cred_ok`.
- **`showroom_import_pecas`** (migration 125) — staging das peças extraídas do PowerPoint
  (fluxo original de curadoria, aba "Vincular do PPT"). `imagem_url` aponta pra
  `showroom-lucenera/import/...`. Leitura anônima liberada (RLS com policy `USING (true)`).
- **`showroom_upload_grants`** (SPEC-148, Fluxo A) — `codigo_produto int primary key, path,
  old_path, criado_por, criado_em, expira_em (default now()+15min)`. Liberação temporária de
  upload direto (Opção B do controle de acesso ao Storage — ver "Cuidados" abaixo). RLS on,
  sem policy — só lida pela função `showroom_upload_permitido` usada nas policies de
  `storage.objects`.
- **`showroom_grupo_itens`** (SPEC-148, Fluxo B) — `codigo_produto_principal int, 
  codigo_produto_membro int, quantidade int default 1, criado_em, criado_por`, PK composta
  `(principal, membro)`, `CHECK (membro <> principal)`, índice único em
  `codigo_produto_membro` (um produto só pode ser membro de **1** conjunto por vez). RLS on,
  sem policy — só lida/escrita via RPC SECURITY DEFINER e pela view pública (que roda como
  owner, bypassa RLS).

## RPCs `showroom_*`

Leitura, sem credencial (whitelist não sensível: código, nome, marca, estoque, valor):

- `showroom_buscar_produto(p_termo text)` — autocomplete, `limit 20`. Desde a SPEC-148 retorna
  também `eh_principal_de_grupo boolean` e `membro_de_codigo_produto int`.
- `showroom_listar_produtos_estoque(p_termo text default null)` (SPEC-148) — lista produtos
  com `estoque_showroom > 0`, `limit 1000` (achado SPEC-125: hoje ~266 produtos nessa
  condição — se crescer muito, paginar, ver P-4 da SPEC-148). Também com as 2 colunas de
  composição.

Escrita, credencial obrigatória (`p_user text, p_senha text`, conferida via `showroom_cred_ok`
interno, migration 128):

- `showroom_login(p_user, p_senha)` — só valida, não cria sessão.
- `showroom_vincular_peca` / `showroom_desvincular_peca` (migration 125/128) — fluxo PPT:
  copia `showroom_import_pecas.imagem_url` para `produtos.imagem_showroom_url` +
  `estoque_showroom`.
- `showroom_liberar_upload_produto(p_user, p_senha, p_codigo_produto, p_extensao)` (SPEC-148)
  — gera um `path` novo em `produtos/` e libera update/delete temporário via
  `showroom_upload_grants`. Só libera DELETE do arquivo antigo se ele já estiver em
  `produtos/` (nunca toca `import/`, ver "Cuidados").
- `showroom_confirmar_foto_produto(p_user, p_senha, p_codigo_produto, p_url_publica)`
  (SPEC-148) — valida que a URL corresponde ao path liberado e que o arquivo existe no
  Storage, grava `produtos.imagem_showroom_url`, consome a liberação.
- `showroom_definir_composicao(p_user, p_senha, p_codigo_produto_principal, p_membros jsonb)`
  (SPEC-148) — substituição total e idempotente da lista de membros de um principal (mandar
  `[]` limpa o conjunto).
- `showroom_obter_composicao(p_codigo_produto_principal int)` (SPEC-148) — sem credencial,
  lista os membros atuais de um principal (nome, sku, estoque, valor, quantidade).

## `vw_showroom_publico` — contrato desde a SPEC-125, redesenhado na SPEC-148

1 linha por "peça exibida", 9 colunas (`codigo_produto, nome, marca, categoria,
estoque_showroom, valor_venda, descricao_tecnica, imagem_showroom_url, atualizado_em`),
filtro `ativo AND imagem_showroom_url IS NOT NULL AND estoque_showroom > 0`. Consumida só por
`src/services/showroom.ts` (site público: `PecaCard.tsx`/`PecaDetalhe.tsx`/`useVitrine.ts`).

Desde a SPEC-148, a view passou a ter 2 ramos (`UNION ALL`):

- **Avulsas**: produtos que não são membro nem principal de nenhum `showroom_grupo_itens`.
- **Conjuntos**: produtos principais de um grupo — `nome`/`imagem_showroom_url` vêm do
  principal; `valor_venda` é a soma do principal + `valor_venda * quantidade` de cada membro;
  `estoque_showroom` é o mínimo entre o estoque do principal e o "número de conjuntos
  completos" possível entre os membros (membro `ativo = false` conta como estoque 0 —
  confirmado por Pedro, P-7 da SPEC-148). Conjunto com `estoque_showroom = 0` some da vitrine
  (mesmo `WHERE estoque_showroom > 0` de sempre).

`codigo_produto` continua sendo o identificador da peça exibida — no caso de conjunto, é o
`codigo_produto` do principal, mesma rota `/peca/:codigo`, mesma mensagem de WhatsApp.

## Storage: bucket `showroom-lucenera`

Público, 5 MB, `jpeg/jpg/png/webp`. Duas pastas com dono diferente:

- **`import/`** — fluxo PPT (migration 125), só gravado por scripts internos. **Nunca** tocado
  pelas RPCs de upload da SPEC-148 (nem update, nem delete) — mesma foto pode estar referenciada
  tanto em `showroom_import_pecas.imagem_url` quanto em `produtos.imagem_showroom_url` (copiada
  pelo `showroom_vincular_peca`), então apagar um arquivo de `import/` quebraria a aba
  "Vincular do PPT".
- **`produtos/`** (SPEC-148, Fluxo A) — upload direto pela aba "Fotos do estoque". Escrita
  (`INSERT`/`UPDATE`/`DELETE`) liberada para `anon`/`authenticated` só quando existe uma linha
  válida (não expirada) em `showroom_upload_grants` para aquele path exato — mecanismo
  necessário porque este sistema nunca tem sessão `authenticated` de verdade (ver "Cuidados").

Leitura pública sempre liberada (`showroom_lucenera_public_read`, não alterada pela SPEC-148).

## Cuidados

- **Nunca dar policy de Storage `anon`/`authenticated` sem passar pela `showroom_upload_grants`**
  — como o client é sempre anônimo, uma policy "aberta" por prefixo de pasta (o padrão mais
  simples, usado em outros buckets como `orcamentos`) deixaria qualquer pessoa que descubra o
  endpoint subir/sobrescrever/apagar arquivos sem login. A Opção B (liberação temporária via
  RPC autenticada por credencial) foi escolhida explicitamente por Pedro em 2026-09-15 — não
  reverter para policy aberta sem nova decisão de negócio.
- **Nunca liberar DELETE de um path em `import/`** a partir das RPCs de upload direto — só
  `produtos/`.
- `produtos.codigo_produto` é a chave usada em toda RPC deste sistema — nunca usar `produtos.id`
  (uuid interno) nas RPCs `showroom_*`.
- `showroom_grupo_itens` não altera `produtos.estoque_showroom` nem `produtos.valor_venda` — o
  agrupamento é só de exibição na view; o estoque real de cada peça física continua individual
  em `produtos`.
- Um produto só pode ser membro de **1** conjunto por vez (índice único
  `showroom_grupo_itens_membro_unico`). Se essa regra mudar no futuro, revisar também a fórmula
  de estoque agregado da view (hoje assume relação 1:1 entre membro e conjunto).
- **Achado (SPEC-148)**: `supabase/db/current/01_schema_full.sql` não reflete
  `produtos.imagem_showroom_url` nem nenhuma tabela/função `showroom_*`, embora tudo isso
  esteja aplicado no Supabase real desde as migrations 126/127/128/137. Não usar o snapshot
  central como referência para este domínio — ler o banco real ou este arquivo.
- Precedente que **não é reaproveitável aqui**: `catalogo-pecas-ubiqua-e6fa0` também faz
  upload direto do client, mas as policies daquele bucket são `TO authenticated` (Supabase Auth
  de verdade) — o showroom nunca tem sessão `authenticated`, então o mesmo padrão de policy não
  funciona sem o mecanismo de `showroom_upload_grants`.

## Empréstimo de peças (SPEC-219, migration 231, aplicada 22/10/2026)

Registro de peças emprestadas a clientes + termo em PDF para o cliente assinar. **Só registro:
não mexe em `produtos.estoque_showroom` nem na vitrine** (decisão do Pedro). A soma emprestada
em aberto pode passar do estoque do showroom — a tela só avisa.

- **`showroom_emprestimos`** — `numero` (sequence, exibido `EMP-0001`), `empresa_id` → `empresas`,
  `contato_id` → `contatos` (tipo `cliente`), `cliente_snapshot jsonb` (dados do cliente no dia —
  o termo não muda se o cadastro mudar), `data_emprestimo`, `data_prevista_devolucao`,
  `observacoes`, `cancelado_em/cancelado_motivo`, `criado_por` (usuário do /admin).
- **`showroom_emprestimo_itens`** — `produto_id`, snapshot de `codigo_produto/nome/referencia`,
  `quantidade`, `valor_unitario` (= `valor_venda` no dia; é o valor integral cobrado se houver
  dano), `situacao` (`emprestado` | `devolvido` | `devolvido_com_dano`), `data_devolucao`,
  `descricao_dano`, `valor_dano` (padrão = integral, pode ser menor, nunca maior).
- Status do empréstimo é **calculado** (função interna `showroom_emp_status`, sem grant):
  `cancelado`, `em_aberto`, `atrasado` (em aberto e prazo vencido, fuso São Paulo),
  `devolvido`, `devolvido_com_dano`.
- Tabelas com RLS ligado, sem policy, sem grant. Tudo passa pelas RPCs `showroom_emp_*`
  (SECURITY DEFINER, credencial do /admin, EXECUTE só para `anon` — revogado de `authenticated`):
  `buscar_cliente`, `listar_empresas`, `em_aberto_por_peca`, `criar`, `listar`, `obter`,
  `registrar_devolucao`, `cancelar` (só se nenhuma peça foi devolvida).
- `contatos` tem dado pessoal: nunca ler direto daqui — só pela `showroom_emp_buscar_cliente`
  (filtra `tipo = 'cliente'`, `ativo`, `canonical_id IS NULL`, limite 20).
