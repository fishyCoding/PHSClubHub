import { Link } from 'react-router-dom';
import { Empty } from '../components/ui';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="card">
      <Empty title={`That ${what} doesn't exist`}>
        <Link to="/">Go home</Link>
      </Empty>
    </div>
  );
}
