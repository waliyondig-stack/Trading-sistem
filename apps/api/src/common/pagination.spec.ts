import 'reflect-metadata';
import { pageArgs, paginate, PaginationQueryDto } from './pagination';

describe('pagination', () => {
  it('menghitung skip/take dari query', () => {
    const query = new PaginationQueryDto();
    query.page = 3;
    query.pageSize = 10;
    expect(pageArgs(query)).toEqual({ skip: 20, take: 10, page: 3, pageSize: 10 });
  });

  it('memakai nilai default bila kosong', () => {
    const query = new PaginationQueryDto();
    expect(pageArgs(query)).toEqual({ skip: 0, take: 20, page: 1, pageSize: 20 });
  });

  it('menghasilkan meta yang benar', () => {
    const result = paginate(['a'], 41, 2, 20);
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 41, totalPages: 3 });
  });
});
