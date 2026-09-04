-- =========================================================
-- 0072 · localizacoes_suspeitas: menos falso positivo no "teleporte"
--
-- Caso real encontrado: duas marcações a 42 segundos uma da outra, 1.86km de
-- distância = 160km/h "de pico" — isso não é viagem impossível, é deriva
-- normal de GPS (sinal ruim, reflexo em prédio) num intervalo curto demais
-- pra significar algo. Ajustes:
--
--  1) só considera "teleporte" quando o intervalo entre as marcações é de
--     pelo menos p_intervalo_minimo_minutos (padrão 5min) — abaixo disso, a
--     imprecisão do próprio GPS já explica um salto de 1-2km sem precisar
--     de deslocamento real.
--  2) velocidade limite sobe de 140 para 180km/h (folga maior pra trecho de
--     rodovia real, sem abrir mão de pegar casos absurdos).
-- =========================================================

create or replace function tlp_presenca.localizacoes_suspeitas(
  p_dias integer default 30,
  p_velocidade_maxima_kmh double precision default 180,
  p_precisao_suspeita_metros double precision default 1,
  p_intervalo_minimo_minutos double precision default 5
)
returns table(
  colaborador_id uuid,
  colaborador_nome text,
  colaborador_matricula text,
  lider_nome text,
  tipo_suspeita text, -- 'teleporte' | 'precisao_suspeita'
  horario_registrado timestamptz,
  latitude double precision,
  longitude double precision,
  precisao_metros double precision,
  horario_anterior timestamptz,
  distancia_km double precision,
  velocidade_kmh double precision
)
language plpgsql
stable
security definer
set search_path = tlp_presenca
as $$
begin
  if not (tlp_presenca.sou_auditor() or tlp_presenca.sou_admin()) then
    raise exception 'Só auditoria tem acesso a essa lista';
  end if;

  return query
    with marcacoes as (
      select
        rp.colaborador_id,
        rp.horario_registrado,
        rp.latitude,
        rp.longitude,
        rp.precisao_metros
      from tlp_presenca.registros_presenca rp
      where rp.data_referencia >= (now() at time zone 'America/Sao_Paulo')::date - p_dias
        and rp.latitude is not null and rp.longitude is not null
      union all
      select
        ma.colaborador_id,
        ma.horario_registrado,
        ma.latitude,
        ma.longitude,
        ma.precisao_metros
      from tlp_presenca.marcacoes_atendimento ma
      where ma.data_referencia >= (now() at time zone 'America/Sao_Paulo')::date - p_dias
        and ma.latitude is not null and ma.longitude is not null
    ),
    com_anterior as (
      select
        m.colaborador_id as m_colaborador_id,
        m.horario_registrado as m_horario_registrado,
        m.latitude as m_latitude,
        m.longitude as m_longitude,
        m.precisao_metros as m_precisao_metros,
        lag(m.horario_registrado) over w as m_horario_anterior,
        lag(m.latitude) over w as lat_anterior,
        lag(m.longitude) over w as lon_anterior
      from marcacoes m
      window w as (partition by m.colaborador_id order by m.horario_registrado)
    ),
    com_distancia as (
      select
        *,
        case when lat_anterior is not null then
          -- Haversine, resultado em km.
          2 * 6371 * asin(sqrt(
            power(sin(radians(m_latitude - lat_anterior) / 2), 2) +
            cos(radians(lat_anterior)) * cos(radians(m_latitude)) *
            power(sin(radians(m_longitude - lon_anterior) / 2), 2)
          ))
        end as m_distancia_km
      from com_anterior
    ),
    avaliadas as (
      select
        *,
        extract(epoch from (m_horario_registrado - m_horario_anterior)) / 3600.0 as m_horas_decorridas
      from com_distancia
    ),
    sinais as (
      select
        m_colaborador_id as colaborador_id,
        m_horario_registrado as horario_registrado,
        m_latitude as latitude,
        m_longitude as longitude,
        m_precisao_metros as precisao_metros,
        m_horario_anterior as horario_anterior,
        m_distancia_km as distancia_km,
        case when m_horas_decorridas > 0 then m_distancia_km / m_horas_decorridas end as velocidade_kmh,
        'teleporte'::text as tipo_suspeita
      from avaliadas
      where m_horario_anterior is not null
        and m_distancia_km is not null
        and m_horas_decorridas >= (p_intervalo_minimo_minutos / 60.0)
        and (m_distancia_km / m_horas_decorridas) > p_velocidade_maxima_kmh

      union all

      select
        m_colaborador_id as colaborador_id,
        m_horario_registrado as horario_registrado,
        m_latitude as latitude,
        m_longitude as longitude,
        m_precisao_metros as precisao_metros,
        m_horario_anterior as horario_anterior,
        m_distancia_km as distancia_km,
        null::double precision as velocidade_kmh,
        'precisao_suspeita'::text as tipo_suspeita
      from avaliadas
      where m_precisao_metros is not null
        and m_precisao_metros <= p_precisao_suspeita_metros
    )
    select
      s.colaborador_id,
      c.nome,
      c.matricula,
      lider.nome,
      s.tipo_suspeita,
      s.horario_registrado,
      s.latitude,
      s.longitude,
      s.precisao_metros,
      s.horario_anterior,
      s.distancia_km,
      s.velocidade_kmh
    from sinais s
    join tlp_presenca.colaboradores c on c.id = s.colaborador_id
    left join tlp_presenca.perfis lider on lider.id = c.lider_id
    order by s.horario_registrado desc;
end;
$$;

comment on function tlp_presenca.localizacoes_suspeitas(integer, double precision, double precision, double precision) is
  'Sinais indiretos de possível GPS fake (teleporte impossível entre marcações com pelo menos p_intervalo_minimo_minutos de intervalo + precisão suspeita) nos últimos p_dias dias — restrito a auditoria/admin. Não é prova, é indício pra checar caso a caso.';

-- Assinatura antiga (3 parâmetros) fica órfã — remove pra não ambiguar chamadas.
drop function if exists tlp_presenca.localizacoes_suspeitas(integer, double precision, double precision);
