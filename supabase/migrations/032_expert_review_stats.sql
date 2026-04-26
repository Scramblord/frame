create or replace view expert_review_stats as
select
  reviewee_id as expert_user_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*) as review_count
from reviews
group by reviewee_id;
