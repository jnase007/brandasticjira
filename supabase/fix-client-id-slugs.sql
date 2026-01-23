-- Fix boards and tickets that were saved with client_id = client.slug
-- 1) Normalize boards
update boards
set client_id = clients.id
from clients
where boards.client_id::text = clients.slug;

-- 2) Normalize tickets (direct slug mismatch)
update tickets
set client_id = clients.id
from clients
where tickets.client_id::text = clients.slug;

-- 3) Fill any remaining ticket client_id from its board
update tickets
set client_id = boards.client_id
from boards
where tickets.board_id = boards.id
  and (tickets.client_id is null or tickets.client_id::text <> boards.client_id::text);

