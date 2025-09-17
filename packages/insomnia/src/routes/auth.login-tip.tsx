import { Heading } from 'react-aria-components';
import { href, useNavigate } from 'react-router';

const Component = () => {
  const navigate = useNavigate();
  return (
    <div className="border-box flex min-h-[150px] flex-col items-center text-center text-[--color-font]">
      <Heading className="py-8 text-2xl">Check your browser to login</Heading>

      <p className="mb-4 text-base text-[--hl]">Having trouble logging in?</p>
      <button
        className="font-medium text-[--color-surprise] transition-colors hover:text-[--color-surprise-dark]"
        onClick={() => {
          navigate(href('/auth/authorize'));
        }}
      >
        Show login alternatives
      </button>
    </div>
  );
};

export default Component;
