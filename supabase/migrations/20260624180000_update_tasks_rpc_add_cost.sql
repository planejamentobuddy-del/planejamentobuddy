-- Update update_tasks RPC to support cost field
CREATE OR REPLACE FUNCTION update_tasks(updates JSONB)
RETURNS VOID AS $$
DECLARE
  item JSONB;
  t_id UUID;
BEGIN
  FOR item IN SELECT jsonb_array_elements(updates) LOOP
    t_id := (item->>'id')::UUID;
    
    UPDATE public.tasks
    SET
      name = CASE WHEN item ? 'name' THEN (item->>'name') ELSE name END,
      start_date = CASE WHEN item ? 'start_date' THEN (item->>'start_date')::DATE ELSE start_date END,
      end_date = CASE WHEN item ? 'end_date' THEN (item->>'end_date')::DATE ELSE end_date END,
      duration = CASE WHEN item ? 'duration' THEN (item->>'duration')::INT ELSE duration END,
      percent_complete = CASE WHEN item ? 'percent_complete' THEN (item->>'percent_complete')::INT ELSE percent_complete END,
      responsible = CASE WHEN item ? 'responsible' THEN (item->>'responsible') ELSE responsible END,
      predecessors = CASE WHEN item ? 'predecessors' THEN ARRAY(SELECT jsonb_array_elements_text(item->'predecessors')) ELSE predecessors END,
      has_restriction = CASE WHEN item ? 'has_restriction' THEN (item->>'has_restriction')::BOOLEAN ELSE has_restriction END,
      restriction_type = CASE WHEN item ? 'restriction_type' THEN (item->>'restriction_type') ELSE restriction_type END,
      status = CASE WHEN item ? 'status' THEN (item->>'status') ELSE status END,
      observations = CASE WHEN item ? 'observations' THEN (item->>'observations') ELSE observations END,
      last_status = CASE WHEN item ? 'last_status' THEN (item->>'last_status') ELSE last_status END,
      last_status_date = CASE WHEN item ? 'last_status_date' THEN (item->>'last_status_date')::DATE ELSE last_status_date END,
      status_comments = CASE WHEN item ? 'status_comments' THEN (item->'status_comments') ELSE status_comments END,
      checklists = CASE WHEN item ? 'checklists' THEN (item->'checklists') ELSE checklists END,
      order_index = CASE WHEN item ? 'order_index' THEN (item->>'order_index')::INT ELSE order_index END,
      location = CASE WHEN item ? 'location' THEN (item->>'location') ELSE location END,
      discipline = CASE WHEN item ? 'discipline' THEN (item->>'discipline') ELSE discipline END,
      frentes = CASE WHEN item ? 'frentes' THEN (item->'frentes') ELSE frentes END,
      frentes_mode = CASE WHEN item ? 'frentes_mode' THEN (item->>'frentes_mode') ELSE frentes_mode END,
      cost = CASE WHEN item ? 'cost' THEN (item->>'cost')::NUMERIC ELSE cost END
    WHERE public.tasks.id = t_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
