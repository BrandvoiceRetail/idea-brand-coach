-- Create trigger to link beta tester data when new user signs up
CREATE TRIGGER on_auth_user_created_link_beta_data
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_beta_tester_to_user();